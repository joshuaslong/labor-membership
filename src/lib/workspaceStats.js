import { createClient } from '@/lib/supabase/server'
import { hasRole } from '@/lib/permissions'

/**
 * Get stats for workspace home based on user role
 *
 * @param {Object} teamMember - The team member object with roles and chapter_id
 * @param {string} teamMember.id - The team member's ID
 * @param {Array} teamMember.roles - Array of role strings
 * @param {string} [teamMember.chapter_id] - Optional chapter ID for filtering
 * @returns {Promise<Object>} Stats object with members, pending, events, and tasks counts
 * @throws {Error} If teamMember is invalid or missing required fields
 */
export async function getWorkspaceStats(teamMember) {
  // Input validation
  if (!teamMember?.roles || !teamMember?.id) {
    throw new Error('Invalid team member: missing required fields (id, roles)')
  }

  const supabase = await createClient()
  const roles = teamMember.roles

  // Determine if user has full access
  const hasFullAccess = hasRole(roles, ['super_admin', 'national_admin'])

  // Build chapter filter
  let chapterFilter = null
  if (!hasFullAccess && teamMember.chapter_id) {
    // For geographic admins, get chapter + descendants
    if (hasRole(roles, ['state_admin', 'county_admin', 'city_admin'])) {
      const { data: descendants, error: descendantsError } = await supabase
        .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })

      if (descendantsError) {
        console.error('Error fetching chapter descendants:', descendantsError)
        // Fallback to just the team member's chapter
        chapterFilter = [teamMember.chapter_id]
      } else {
        chapterFilter = descendants?.map(d => d.id) || [teamMember.chapter_id]
      }
    } else {
      // For team members, just their chapter
      chapterFilter = [teamMember.chapter_id]
    }
  }

  // Format date for event query (YYYY-MM-DD format for date field)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const startOfMonthDate = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-01`

  // Build queries for parallel execution
  let memberQuery = supabase.from('members').select('id, chapter_id', { count: 'exact', head: true })
  if (chapterFilter) {
    memberQuery = memberQuery.in('chapter_id', chapterFilter)
  }

  // NOTE: Using 'status' field which may be deprecated in favor of segments in future schema updates
  let pendingQuery = supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  if (chapterFilter) {
    pendingQuery = pendingQuery.in('chapter_id', chapterFilter)
  }

  let eventQuery = supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .gte('start_date', startOfMonthDate) // Fixed: use start_date (date field) instead of start_time
  if (chapterFilter) {
    eventQuery = eventQuery.in('chapter_id', chapterFilter)
  }

  const taskQuery = supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('owner', teamMember.id)
    .neq('status', 'DONE')

  // Execute queries in parallel for better performance
  const [memberResult, pendingResult, eventResult, taskResult] = await Promise.all([
    memberQuery,
    pendingQuery,
    eventQuery,
    taskQuery
  ])

  // Error handling for each query
  if (memberResult.error) {
    console.error('Error fetching member count:', memberResult.error)
  }
  if (pendingResult.error) {
    console.error('Error fetching pending member count:', pendingResult.error)
  }
  if (eventResult.error) {
    console.error('Error fetching event count:', eventResult.error)
  }
  if (taskResult.error) {
    console.error('Error fetching task count:', taskResult.error)
  }

  return {
    members: memberResult.count || 0,
    pending: pendingResult.count || 0,
    events: eventResult.count || 0,
    tasks: taskResult.count || 0
  }
}
