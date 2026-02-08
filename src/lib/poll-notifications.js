import { createAdminClient } from '@/lib/supabase/server'
import { sendAutomatedEmail, formatEmailDate } from '@/lib/email-templates'

/**
 * Send new poll notification emails to eligible members
 * For chapter polls: all members in the chapter
 * For group polls: all members in the group
 */
export async function sendNewPollNotifications(poll) {
  const supabase = createAdminClient()

  // Get the chapter info
  const { data: chapter } = await supabase
    .from('chapters')
    .select('id, name')
    .eq('id', poll.chapter_id)
    .single()

  if (!chapter) {
    console.error('Chapter not found for poll:', poll.id)
    return { success: false, error: 'Chapter not found' }
  }

  // Get question count for this poll
  const { count: questionCount } = await supabase
    .from('poll_questions')
    .select('*', { count: 'exact', head: true })
    .eq('poll_id', poll.id)

  // Format deadline
  const pollDeadline = poll.closes_at
    ? formatEmailDate(poll.closes_at)
    : 'Open-ended'

  let allMemberIds = []
  let groupName = ''

  if (poll.target_type === 'group' && poll.group_id) {
    // Get group name
    const { data: group } = await supabase
      .from('chapter_groups')
      .select('name')
      .eq('id', poll.group_id)
      .single()
    groupName = group?.name || ''

    // Get members in the specific group
    const { data: groupAssignments } = await supabase
      .from('member_group_assignments')
      .select('member_id')
      .eq('group_id', poll.group_id)

    allMemberIds = groupAssignments?.map(ga => ga.member_id) || []
  } else {
    // Get all members in this chapter via member_chapters junction table
    const { data: memberChapters } = await supabase
      .from('member_chapters')
      .select('member_id')
      .eq('chapter_id', poll.chapter_id)

    const memberIdsFromJunction = memberChapters?.map(mc => mc.member_id) || []

    // Also get members with legacy chapter_id
    const { data: legacyMembers } = await supabase
      .from('members')
      .select('id')
      .eq('chapter_id', poll.chapter_id)

    const legacyMemberIds = legacyMembers?.map(m => m.id) || []

    // Combine and dedupe
    allMemberIds = [...new Set([...memberIdsFromJunction, ...legacyMemberIds])]
  }

  if (allMemberIds.length === 0) {
    console.log('No members found for poll notifications:', poll.title)
    return { success: true, count: 0 }
  }

  // Get member details
  const { data: members } = await supabase
    .from('members')
    .select('id, email, first_name, last_name, status')
    .in('id', allMemberIds)
    .eq('status', 'active')

  if (!members || members.length === 0) {
    console.log('No active members found for poll notifications:', poll.title)
    return { success: true, count: 0 }
  }

  // Poll URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://members.votelabor.org'
  const pollUrl = `${appUrl}/workspace/polls/${poll.id}`

  // Send notifications to each member
  let successCount = 0
  let errorCount = 0
  const results = []

  for (let i = 0; i < members.length; i++) {
    const member = members[i]

    // Rate limit: Resend allows 2 req/sec, space out sends by 600ms
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 600))
    }

    try {
      const result = await sendAutomatedEmail({
        templateKey: 'new_poll',
        to: member.email,
        variables: {
          name: member.first_name || 'Member',
          poll_title: poll.title,
          poll_description: poll.description || '',
          chapter_name: chapter.name,
          poll_group_row: groupName
            ? `<tr><td style="padding: 6px 12px 6px 0; color: #6b7280; vertical-align: top; white-space: nowrap;"><strong>Group:</strong></td><td style="padding: 6px 0;">${groupName}</td></tr>`
            : '',
          question_count: questionCount || 0,
          poll_deadline: pollDeadline,
          poll_url: pollUrl,
        },
        recipientType: 'member',
        recipientId: member.id,
        relatedId: poll.id,
      })

      if (result.success) {
        successCount++
      } else {
        errorCount++
      }
      results.push({ memberId: member.id, ...result })
    } catch (err) {
      console.error(`Failed to send new poll notification to ${member.email}:`, err)
      errorCount++
      results.push({ memberId: member.id, success: false, error: err.message })
    }
  }

  console.log(`New poll notifications sent for "${poll.title}": ${successCount} success, ${errorCount} failed out of ${members.length} members`)

  return {
    success: true,
    total: members.length,
    successCount,
    errorCount,
    results,
  }
}
