import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendAutomatedEmail, formatEmailDate, formatEmailTime, hasReminderBeenSent } from '@/lib/email-templates'

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
    reminders_24h: { sent: 0, failed: 0, skipped: 0 },
    reminders_1h: { sent: 0, failed: 0, skipped: 0 },
  }

  try {
    // Find events starting in 23-25 hours (for 24h reminder)
    const twentyThreeHours = new Date(now.getTime() + 23 * 60 * 60 * 1000)
    const twentyFiveHours = new Date(now.getTime() + 25 * 60 * 60 * 1000)

    // Find events starting in 0.5-1.5 hours (for 1h reminder)
    const thirtyMinutes = new Date(now.getTime() + 30 * 60 * 1000)
    const ninetyMinutes = new Date(now.getTime() + 90 * 60 * 1000)

    // Get events for 24h reminder
    const { data: events24h } = await supabase
      .from('events')
      .select('id, title, start_date, location')
      .eq('status', 'published')
      .gte('start_date', twentyThreeHours.toISOString())
      .lte('start_date', twentyFiveHours.toISOString())

    // Get events for 1h reminder
    const { data: events1h } = await supabase
      .from('events')
      .select('id, title, start_date, location')
      .eq('status', 'published')
      .gte('start_date', thirtyMinutes.toISOString())
      .lte('start_date', ninetyMinutes.toISOString())

    // Process 24h reminders
    for (const event of events24h || []) {
      await sendEventReminders(supabase, event, 'event_reminder_24h', results.reminders_24h)
    }

    // Process 1h reminders
    for (const event of events1h || []) {
      await sendEventReminders(supabase, event, 'event_reminder_1h', results.reminders_1h)
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

async function sendEventReminders(supabase, event, templateKey, stats) {
  // Get member RSVPs (attending or maybe)
  const { data: memberRsvps } = await supabase
    .from('event_rsvps')
    .select(`
      member_id,
      members!inner(id, email, first_name)
    `)
    .eq('event_id', event.id)
    .in('status', ['attending', 'maybe'])

  // Get guest RSVPs
  const { data: guestRsvps } = await supabase
    .from('event_guest_rsvps')
    .select('id, name, email')
    .eq('event_id', event.id)
    .eq('status', 'attending')

  const emailVariables = {
    event_name: event.title,
    event_date: formatEmailDate(event.start_date),
    event_time: formatEmailTime(event.start_date),
    event_location: event.location || 'TBD',
  }

  // Send to members
  for (const rsvp of memberRsvps || []) {
    const member = rsvp.members
    if (!member?.email) continue

    // Check if reminder already sent
    const alreadySent = await hasReminderBeenSent(templateKey, member.email, event.id)
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
        relatedId: event.id,
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
    const alreadySent = await hasReminderBeenSent(templateKey, guest.email, event.id)
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
        relatedId: event.id,
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
