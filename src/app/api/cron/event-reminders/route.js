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

export async function GET(request) {
  // Verify this is a legitimate cron request
  if (process.env.CRON_SECRET && !verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const results = {
    reminders_tomorrow: { sent: 0, failed: 0, skipped: 0 },
    reminders_today: { sent: 0, failed: 0, skipped: 0 },
  }

  try {
    // Date-based approach: send reminders for events today and tomorrow
    // Works with once-daily cron on Vercel Hobby plan
    const today = now.toISOString().split('T')[0]
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const dayAfterTomorrow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Get non-recurring published events for today and tomorrow
    const { data: oneTimeEvents } = await supabase
      .from('events')
      .select('id, title, start_date, start_time, location_name, rrule')
      .eq('status', 'published')
      .is('rrule', null)
      .gte('start_date', today)
      .lt('start_date', dayAfterTomorrow)

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

    // Combine all events
    const allInstances = [
      ...(oneTimeEvents || []).map(e => ({ ...e, instance_date: e.start_date })),
      ...recurringInstances,
    ]

    // Send reminders based on date
    for (const event of allInstances) {
      const relatedId = event.rrule
        ? `${event.id}:${event.instance_date}`
        : event.id

      if (event.instance_date === tomorrow) {
        // Day-before reminder (tomorrow's events)
        await sendEventReminders(
          supabase, event, event.instance_date, relatedId,
          'event_reminder_24h', results.reminders_tomorrow
        )
      }

      if (event.instance_date === today) {
        // Day-of reminder (today's events)
        await sendEventReminders(
          supabase, event, event.instance_date, relatedId,
          'event_reminder_1h', results.reminders_today
        )
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

    const alreadySent = await hasReminderBeenSent(templateKey, guest.email, relatedId)
    if (alreadySent) {
      stats.skipped++
      continue
    }

    try {
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
