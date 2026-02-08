import { createAdminClient } from '@/lib/supabase/server'
import { sendAutomatedEmail, formatEmailDate, formatEmailTime } from '@/lib/email-templates'
import { describeRrule } from '@/lib/recurrence'

/**
 * Send new event notification emails to all members in the event's chapter
 */
export async function sendNewEventNotifications(event) {
  const supabase = createAdminClient()

  // Get the chapter info
  const { data: chapter } = await supabase
    .from('chapters')
    .select('id, name')
    .eq('id', event.chapter_id)
    .single()

  if (!chapter) {
    console.error('Chapter not found for event:', event.id)
    return { success: false, error: 'Chapter not found' }
  }

  // Get all members in this chapter via member_chapters junction table
  const { data: memberChapters } = await supabase
    .from('member_chapters')
    .select('member_id')
    .eq('chapter_id', event.chapter_id)

  const memberIdsFromJunction = memberChapters?.map(mc => mc.member_id) || []

  // Also get members with legacy chapter_id
  const { data: legacyMembers } = await supabase
    .from('members')
    .select('id')
    .eq('chapter_id', event.chapter_id)

  const legacyMemberIds = legacyMembers?.map(m => m.id) || []

  // Combine and dedupe member IDs
  const allMemberIds = [...new Set([...memberIdsFromJunction, ...legacyMemberIds])]

  if (allMemberIds.length === 0) {
    console.log('No members found in chapter for event notifications:', chapter.name)
    return { success: true, count: 0 }
  }

  // Get member details
  const { data: members } = await supabase
    .from('members')
    .select('id, email, first_name, last_name, status')
    .in('id', allMemberIds)
    .eq('status', 'active') // Only notify active members

  if (!members || members.length === 0) {
    console.log('No active members found in chapter for event notifications:', chapter.name)
    return { success: true, count: 0 }
  }

  // Build location string
  let location = ''
  if (event.is_virtual) {
    location = 'Virtual Event'
    if (event.virtual_link) {
      location += ` - Link will be provided upon RSVP`
    }
  } else {
    const parts = [
      event.location_name,
      event.location_address,
      event.location_city && event.location_state
        ? `${event.location_city}, ${event.location_state}`
        : (event.location_city || event.location_state),
      event.location_zip
    ].filter(Boolean)
    location = parts.join(', ') || 'Location TBD'
  }

  // Format date and time
  const eventDate = formatEmailDate(event.start_date)
  let eventTime = ''
  if (event.is_all_day) {
    eventTime = 'All Day'
  } else if (event.start_time) {
    eventTime = formatEmailTime(`${event.start_date}T${event.start_time}`)
    if (event.end_time) {
      eventTime += ` - ${formatEmailTime(`${event.start_date}T${event.end_time}`)}`
    }
  }

  // Recurrence info
  let recurrenceRow = ''
  if (event.rrule) {
    try {
      const recurrenceText = describeRrule(event.rrule, event.start_date)
      if (recurrenceText) {
        recurrenceRow = `<tr><td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top; white-space: nowrap;"><strong>Repeats:</strong></td><td style="padding: 6px 0;">${recurrenceText}</td></tr>`
      }
    } catch (e) {
      // describeRrule may fail for malformed rrules, skip silently
    }
  }

  // Event URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://members.votelabor.org'
  const eventUrl = `${appUrl}/events/${event.id}`

  // Send notifications to each member
  const results = []
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < members.length; i++) {
    const member = members[i]

    // Rate limit: Resend allows 2 req/sec, space out sends by 600ms
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 600))
    }

    try {
      const result = await sendAutomatedEmail({
        templateKey: 'new_event',
        to: member.email,
        variables: {
          name: member.first_name || 'Member',
          event_name: event.title,
          event_date: eventDate,
          event_time: eventTime,
          event_location: location,
          event_description: event.description || '',
          event_recurrence_row: recurrenceRow,
          event_url: eventUrl,
        },
        recipientType: 'member',
        recipientId: member.id,
        relatedId: event.id,
      })

      if (result.success) {
        successCount++
      } else {
        errorCount++
      }
      results.push({ memberId: member.id, ...result })
    } catch (err) {
      console.error(`Failed to send new event notification to ${member.email}:`, err)
      errorCount++
      results.push({ memberId: member.id, success: false, error: err.message })
    }
  }

  console.log(`New event notifications sent for "${event.title}": ${successCount} success, ${errorCount} failed out of ${members.length} members`)

  return {
    success: true,
    total: members.length,
    successCount,
    errorCount,
    results,
  }
}
