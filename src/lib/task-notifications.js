import { createAdminClient } from '@/lib/supabase/server'
import { sendAutomatedEmail, formatEmailDate } from '@/lib/email-templates'

/**
 * Send a notification email to the assigned owner of a new task
 */
export async function sendNewTaskNotification(task) {
  if (!task.owner) {
    return { success: true, skipped: true, reason: 'No owner assigned' }
  }

  const supabase = createAdminClient()

  // Get the team member record
  const { data: teamMember } = await supabase
    .from('team_members')
    .select('id, member_id, user_id')
    .eq('id', task.owner)
    .single()

  if (!teamMember) {
    console.error('Team member not found for task notification:', task.owner)
    return { success: false, error: 'Team member not found' }
  }

  // Get email and name - prefer from linked member record
  let email = null
  let firstName = null

  if (teamMember.member_id) {
    const { data: member } = await supabase
      .from('members')
      .select('email, first_name')
      .eq('id', teamMember.member_id)
      .single()

    if (member) {
      email = member.email
      firstName = member.first_name
    }
  }

  // Fall back to auth user email if no member record
  if (!email && teamMember.user_id) {
    const { data: { user } } = await supabase.auth.admin.getUserById(teamMember.user_id)
    if (user) {
      email = user.email
    }
  }

  if (!email) {
    console.error('No email found for team member:', task.owner)
    return { success: false, error: 'No email found for team member' }
  }

  // Build task URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://members.votelabor.org'
  const taskUrl = `${appUrl}/workspace/tasks/${task.id}`

  // Format deadline
  const deadline = task.deadline ? formatEmailDate(task.deadline) : 'No deadline'

  // Priority labels
  const priorityLabels = { P1: 'Critical', P2: 'High', P3: 'Standard' }
  const priority = priorityLabels[task.priority] || task.priority

  try {
    const result = await sendAutomatedEmail({
      templateKey: 'new_task',
      to: email,
      variables: {
        name: firstName || 'Team Member',
        task_name: task.name,
        task_deliverable: task.deliverable || '',
        task_project: task.project || '',
        task_deadline: deadline,
        task_priority: priority,
        task_url: taskUrl,
      },
      recipientType: 'team_member',
      recipientId: teamMember.id,
      relatedId: task.id,
    })

    if (result.success) {
      console.log(`Task notification sent for "${task.name}" to ${email}`)
    }

    return result
  } catch (err) {
    console.error(`Failed to send task notification to ${email}:`, err)
    return { success: false, error: err.message }
  }
}
