import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendAutomatedEmail, formatEmailDate, formatEmailTime, hasReminderBeenSent } from '@/lib/email-templates'
import { getOccurrences } from '@/lib/recurrence'

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return false
  }
  return true
}

/**
 * Combine a date string (YYYY-MM-DD) and time string (HH:MM:SS) into a Date object.
 * If no time is provided, defaults to midnight.
 */
function combineDateAndTime(dateStr, timeStr) {
  if (!timeStr) return new Date(dateStr + 'T00:00:00')
  return new Date(`${dateStr}T${timeStr}`)
}

export async function GET(request) {
  // Verify this is a legitimate cron request
  if (process.env.CRON_SECRET && !verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const results = {
    reminders_24h: { sent: 0, failed: 0, skipped: 0 },
    reminders_1h: { sent: 0, failed: 0, skipped: 0 },
  }

  try {
    // Define reminder windows
    const windows = [
      {
        key: 'reminders_24h',
        templateKey: 'event_reminder_24h',
        startMs: 23 * 60 * 60 * 1000,
        endMs: 25 * 60 * 60 * 1000,
      },
      {
        key: 'reminders_1h',
        templateKey: 'event_reminder_1h',
        startMs: 30 * 60 * 1000,
        endMs: 90 * 60 * 1000,
      },
    ]

    // Date range for queries: today and tomorrow (covers both windows)
    const today = now.toISOString().split('T')[0]
    const dayAfterTomorrow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Get non-recurring published events in the date range
    const { data: oneTimeEvents } = await supabase
      .from('events')
      .select('id, title, start_date, start_time, location_name, rrule')
      .eq('status', 'published')
      .is('rrule', null)
      .gte('start_date', today)
      .lte('start_date', dayAfterTomorrow)

    // Get recurring published events that might have instances in range
    const { data: recurringEvents } = await supabase
      .from('events')
      .select('id, title, start_date, start_time, location_name, rrule, recurrence_end_date')
      .eq('status', 'published')
      .not('rrule', 'is', null)
      .lte('start_date', dayAfterTomorrow)
      .or(`recurrence_end_date.gte.${today},recurrence_end_date.is.null`)

    // Expand recurring events to find instances in range
    const recurringInstances = []
    for (const event of recurringEvents || []) {
      try {
        const occurrences = getOccurrences(
          event.rrule,
          event.start_date,
          today,
          dayAfterTomorrow
        )

        // Check cancelled overrides for these dates
        const instanceDates = occurrences.map(d =>
          d instanceof Date ? d.toISOString().split('T')[0] : d
        )

        if (instanceDates.length === 0) continue

        const { data: overrides } = await supabase
          .from('event_instance_overrides')
          .select('instance_date, is_cancelled')
          .eq('event_id', event.id)
          .in('instance_date', instanceDates)

        const cancelledDates = new Set(
          (overrides || []).filter(o => o.is_cancelled).map(o => o.instance_date)
        )

        for (const instDate of instanceDates) {
          if (!cancelledDates.has(instDate)) {
            recurringInstances.push({
              ...event,
              instance_date: instDate,
            })
          }
        }
      } catch (err) {
        console.error(`Failed to expand recurring event ${event.id}:`, err)
      }
    }

    // Combine all events (one-time use start_date as instance_date)
    const allInstances = [
      ...(oneTimeEvents || []).map(e => ({ ...e, instance_date: e.start_date })),
      ...recurringInstances,
    ]

    // Process each reminder window
    for (const window of windows) {
      const windowStart = new Date(now.getTime() + window.startMs)
      const windowEnd = new Date(now.getTime() + window.endMs)

      for (const event of allInstances) {
        const eventDateTime = combineDateAndTime(event.instance_date, event.start_time)

        // Check if the event falls within this reminder window
        if (eventDateTime >= windowStart && eventDateTime <= windowEnd) {
          // Use a unique relatedId for recurring instances to avoid duplicate reminders
          const relatedId = event.rrule
            ? `${event.id}:${event.instance_date}`
            : event.id

          await sendEventReminders(
            supabase,
            event,
            event.instance_date,
            relatedId,
            window.templateKey,
            results[window.key]
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    })
  } catch (error) {
    console.error('Cron error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function sendEventReminders(supabase, event, instanceDate, relatedId, templateKey, stats) {
  // Get member RSVPs for this instance (attending or maybe)
  const { data: memberRsvps } = await supabase
    .from('event_rsvps')
    .select(`
      member_id,
      members!inner(id, email, first_name)
    `)
    .eq('event_id', event.id)
    .eq('instance_date', instanceDate)
    .in('status', ['attending', 'maybe'])

  // Get guest RSVPs for this instance
  const { data: guestRsvps } = await supabase
    .from('event_guest_rsvps')
    .select('id, name, email')
    .eq('event_id', event.id)
    .eq('instance_date', instanceDate)
    .eq('status', 'attending')

  const emailVariables = {
    event_name: event.title,
    event_date: formatEmailDate(instanceDate),
    event_time: event.start_time ? formatEmailTime(`${instanceDate}T${event.start_time}`) : '',
    event_location: event.location_name || 'TBD',
  }

  // Send to members
  for (const rsvp of memberRsvps || []) {
    const member = rsvp.members
    if (!member?.email) continue

    // Check if reminder already sent (using composite relatedId for recurring)
    const alreadySent = await hasReminderBeenSent(templateKey, member.email, relatedId)
    if (alreadySent) {
      stats.skipped++
      continue
    }

    try {
      await sendAutomatedEmail({
        templateKey,
        to: member.email,
        variables: {
          ...emailVariables,
          name: member.first_name || 'Member',
        },
        recipientType: 'member',
        recipientId: member.id,
        relatedId,
      })
      stats.sent++
    } catch (error) {
      console.error(`Failed to send reminder to ${member.email}:`, error)
      stats.failed++
    }
  }

  // Send to guests
  for (const guest of guestRsvps || []) {
    if (!guest.email) continue

    // Check if reminder already sent
    const alreadySent = await hasReminderBeenSent(templateKey, guest.email, relatedId)
    if (alreadySent) {
      stats.skipped++
      continue
    }

    try {
      // Extract first name from full name
      const firstName = guest.name.trim().split(' ')[0]
      await sendAutomatedEmail({
        templateKey,
        to: guest.email,
        variables: {
          ...emailVariables,
          name: firstName,
        },
        recipientType: 'guest',
        relatedId,
      })
      stats.sent++
    } catch (error) {
      console.error(`Failed to send reminder to guest ${guest.email}:`, error)
      stats.failed++
    }
  }
}

// Also support POST for manual testing
export async function POST(request) {
  return GET(request)
}
