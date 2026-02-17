import { createAdminClient } from '@/lib/supabase/server'
import { sendAutomatedEmail, formatEmailDate } from '@/lib/email-templates'

/**
 * Send new volunteer opportunity notification emails to chapter members
 * who have opted into volunteering (wants_to_volunteer = true)
 */
export async function sendNewOpportunityNotification(opportunity) {
  const supabase = createAdminClient()

  // Get the chapter info
  const { data: chapter } = await supabase
    .from('chapters')
    .select('id, name')
    .eq('id', opportunity.chapter_id)
    .single()

  if (!chapter) {
    console.error('Chapter not found for volunteer opportunity:', opportunity.id)
    return { success: false, error: 'Chapter not found' }
  }

  // Get all members in this chapter via member_chapters junction table
  const { data: memberChapters } = await supabase
    .from('member_chapters')
    .select('member_id')
    .eq('chapter_id', opportunity.chapter_id)

  const memberIdsFromJunction = memberChapters?.map(mc => mc.member_id) || []

  // Also get members with legacy chapter_id
  const { data: legacyMembers } = await supabase
    .from('members')
    .select('id')
    .eq('chapter_id', opportunity.chapter_id)

  const legacyMemberIds = legacyMembers?.map(m => m.id) || []

  // Combine and dedupe
  const allMemberIds = [...new Set([...memberIdsFromJunction, ...legacyMemberIds])]

  if (allMemberIds.length === 0) {
    console.log('No members found in chapter for volunteer notifications:', chapter.name)
    return { success: true, count: 0 }
  }

  // Get member details - only active members who want to volunteer
  const { data: members } = await supabase
    .from('members')
    .select('id, email, first_name, last_name, status, wants_to_volunteer')
    .in('id', allMemberIds)
    .eq('status', 'active')
    .eq('wants_to_volunteer', true)

  if (!members || members.length === 0) {
    console.log('No active volunteer members found in chapter:', chapter.name)
    return { success: true, count: 0 }
  }

  // Build template variables
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://members.votelabor.org'
  const opportunityUrl = `${appUrl}/organize/${opportunity.id}`

  const typeLabel = opportunity.opportunity_type === 'one_time' ? 'One-time' : 'Ongoing'

  // Date row (only for one-time opportunities with a date)
  let dateRow = ''
  if (opportunity.opportunity_type === 'one_time' && opportunity.event_date) {
    dateRow = `<strong>Date:</strong> ${formatEmailDate(opportunity.event_date)}<br>\n`
  }

  // Location
  let location = 'TBD'
  if (opportunity.is_remote) {
    location = 'Remote'
    if (opportunity.location_name) location += ` (${opportunity.location_name})`
  } else if (opportunity.location_name) {
    location = opportunity.location_name
  }

  // Skills row
  let skillsRow = ''
  if (opportunity.skills_needed && opportunity.skills_needed.length > 0) {
    skillsRow = `<strong>Skills:</strong> ${opportunity.skills_needed.join(', ')}<br>\n`
  }

  // Time commitment row
  let timeCommitmentRow = ''
  if (opportunity.time_commitment) {
    timeCommitmentRow = `<strong>Time Commitment:</strong> ${opportunity.time_commitment}<br>\n`
  }

  // Truncate description for email
  let description = opportunity.description || ''
  if (description.length > 300) {
    description = description.substring(0, 300) + '...'
  }

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
        templateKey: 'new_volunteer_opportunity',
        to: member.email,
        variables: {
          name: member.first_name || 'Member',
          opportunity_title: opportunity.title,
          opportunity_type: typeLabel,
          opportunity_date: dateRow,
          opportunity_location: location,
          opportunity_skills: skillsRow,
          opportunity_time_commitment: timeCommitmentRow,
          opportunity_description: description,
          opportunity_url: opportunityUrl,
        },
        recipientType: 'member',
        recipientId: member.id,
        relatedId: opportunity.id,
      })

      if (result.success) {
        successCount++
      } else {
        errorCount++
      }
      results.push({ memberId: member.id, ...result })
    } catch (err) {
      console.error(`Failed to send volunteer notification to ${member.email}:`, err)
      errorCount++
      results.push({ memberId: member.id, success: false, error: err.message })
    }
  }

  console.log(`Volunteer opportunity notifications sent for "${opportunity.title}": ${successCount} success, ${errorCount} failed out of ${members.length} members`)

  return {
    success: true,
    total: members.length,
    successCount,
    errorCount,
    results,
  }
}
