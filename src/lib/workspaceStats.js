import { createClient } from '@/lib/supabase/server'
import { getEffectiveChapterScope, applyChapterFilter } from '@/lib/chapterScope'

/**
 * Get stats for workspace home based on user role and selected chapter
 *
 * @param {Object} teamMember - The team member object with roles and chapter_id
 * @param {string} teamMember.id - The team member's ID
 * @param {Array} teamMember.roles - Array of role strings
 * @param {string} [teamMember.chapter_id] - Optional chapter ID for filtering
 * @returns {Promise<Object>} Stats object with members, pending, events, and tasks counts
 * @throws {Error} If teamMember is invalid or missing required fields
 */
export async function getWorkspaceStats(teamMember) {
  if (!teamMember?.roles || !teamMember?.id) {
    throw new Error('Invalid team member: missing required fields (id, roles)')
  }

  const supabase = await createClient()
  const scope = await getEffectiveChapterScope(teamMember)

  // Format date for event query
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const startOfMonthDate = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-01`

  // Build queries, applying chapter filter to each
  let memberQuery = supabase.from('members').select('id', { count: 'exact', head: true })
  memberQuery = await applyChapterFilter(memberQuery, scope, supabase)

  let pendingQuery = supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  pendingQuery = await applyChapterFilter(pendingQuery, scope, supabase)

  let eventQuery = supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .gte('start_date', startOfMonthDate)
  eventQuery = await applyChapterFilter(eventQuery, scope, supabase)

  const taskQuery = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('owner', teamMember.id)
    .neq('status', 'DONE')

  // Execute queries in parallel
  const [memberResult, pendingResult, eventResult, taskResult] = await Promise.all([
    memberQuery,
    pendingQuery,
    eventQuery,
    taskQuery
  ])

  if (memberResult.error) console.error('Error fetching member count:', memberResult.error)
  if (pendingResult.error) console.error('Error fetching pending member count:', pendingResult.error)
  if (eventResult.error) console.error('Error fetching event count:', eventResult.error)
  if (taskResult.error) console.error('Error fetching task count:', taskResult.error)

  return {
    members: memberResult.count || 0,
    pending: pendingResult.count || 0,
    events: eventResult.count || 0,
    tasks: taskResult.count || 0
  }
}

/**
 * Get recent members for workspace home, respecting chapter scope
 */
export async function getRecentMembers(teamMember, limit = 5) {
  if (!teamMember?.roles || !teamMember?.id) {
    throw new Error('Invalid team member: missing required fields (id, roles)')
  }

  const supabase = await createClient()
  const scope = await getEffectiveChapterScope(teamMember)

  let query = supabase
    .from('members')
    .select('id, first_name, last_name, email, status, joined_date, chapters(name), member_segments(segment)')
    .order('joined_date', { ascending: false })
    .limit(limit)

  query = await applyChapterFilter(query, scope, supabase)

  const { data, error } = await query

  if (error) {
    console.error('Error fetching recent members:', error)
    return []
  }

  return data || []
}
