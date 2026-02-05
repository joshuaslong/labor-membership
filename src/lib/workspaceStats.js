import { createClient } from '@/lib/supabase/server'
import { hasRole } from '@/lib/permissions'

/**
 * Get stats for workspace home based on user role
 */
export async function getWorkspaceStats(teamMember) {
  const supabase = await createClient()
  const roles = teamMember.roles

  // Determine if user has full access
  const hasFullAccess = hasRole(roles, ['super_admin', 'national_admin'])

  // Build chapter filter
  let chapterFilter = null
  if (!hasFullAccess && teamMember.chapter_id) {
    // For geographic admins, get chapter + descendants
    if (hasRole(roles, ['state_admin', 'county_admin', 'city_admin'])) {
      const { data: descendants } = await supabase
        .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })
      chapterFilter = descendants?.map(d => d.id) || [teamMember.chapter_id]
    } else {
      // For team members, just their chapter
      chapterFilter = [teamMember.chapter_id]
    }
  }

  // Get member counts
  let memberQuery = supabase.from('members').select('id, chapter_id', { count: 'exact', head: true })
  if (chapterFilter) {
    memberQuery = memberQuery.in('chapter_id', chapterFilter)
  }
  const { count: memberCount } = await memberQuery

  // Get pending member count
  let pendingQuery = supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  if (chapterFilter) {
    pendingQuery = pendingQuery.in('chapter_id', chapterFilter)
  }
  const { count: pendingCount } = await pendingQuery

  // Get event count (upcoming this month)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  let eventQuery = supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .gte('start_time', startOfMonth.toISOString())
  if (chapterFilter) {
    eventQuery = eventQuery.in('chapter_id', chapterFilter)
  }
  const { count: eventCount } = await eventQuery

  // Get task count (assigned to user)
  const { count: taskCount } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('owner', teamMember.id)
    .neq('status', 'DONE')

  return {
    members: memberCount || 0,
    pending: pendingCount || 0,
    events: eventCount || 0,
    tasks: taskCount || 0
  }
}
