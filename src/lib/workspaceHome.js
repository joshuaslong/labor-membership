import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getEffectiveChapterScope, resolveChapterIds, applyChapterFilter } from '@/lib/chapterScope'

/**
 * Get all data for the workspace home page in parallel
 */
export async function getHomePageData(teamMember) {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const scope = await getEffectiveChapterScope(teamMember)
  const chapterIds = await resolveChapterIds(scope, supabase)

  const today = new Date().toISOString().split('T')[0]

  // Get the member record (for polls/volunteers which use members table, not team_members)
  const { data: { user } } = await supabase.auth.getUser()
  const { data: member } = user
    ? await adminClient.from('members').select('id').eq('user_id', user.id).single()
    : { data: null }

  const [events, tasks, polls, unread, shifts] = await Promise.all([
    getUpcomingEvents(supabase, chapterIds, today),
    getMyTasks(supabase, teamMember.id),
    member ? getPollsNeedingVote(adminClient, member.id) : [],
    getUnreadMessageCount(adminClient, teamMember.id),
    member ? getUpcomingShifts(adminClient, member.id, today) : [],
  ])

  return { events, tasks, polls, unread, shifts }
}

async function getUpcomingEvents(supabase, chapterIds, today) {
  let query = supabase
    .from('events')
    .select('id, title, start_date, start_time, location_name, location_city, location_state, is_virtual, status, chapter_id, chapters(name)')
    .eq('status', 'published')
    .gte('start_date', today)
    .order('start_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(3)

  query = applyChapterFilter(query, chapterIds)

  const { data, error } = await query
  if (error) {
    console.error('Error fetching upcoming events:', error)
    return []
  }
  return data || []
}

async function getMyTasks(supabase, teamMemberId) {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, name, project, status, priority, deadline')
    .eq('owner', teamMemberId)
    .neq('status', 'DONE')
    .order('deadline', { ascending: true, nullsFirst: false })
    .limit(5)

  if (error) {
    console.error('Error fetching tasks:', error)
    return []
  }
  return data || []
}

async function getPollsNeedingVote(adminClient, memberId) {
  // Get member's chapter IDs
  const { data: memberChapters } = await adminClient
    .from('member_chapters')
    .select('chapter_id')
    .eq('member_id', memberId)

  const chapterIds = memberChapters?.map(mc => mc.chapter_id) || []
  if (chapterIds.length === 0) return []

  // Get active polls targeting member's chapters
  const { data: polls } = await adminClient
    .from('polls')
    .select('id, title, closes_at, chapters(name), poll_questions(count)')
    .eq('status', 'active')
    .eq('target_type', 'chapter')
    .in('chapter_id', chapterIds)
    .order('closes_at', { ascending: true })

  if (!polls || polls.length === 0) return []

  // Check which the member has already voted in
  const pollIds = polls.map(p => p.id)
  const { data: responses } = await adminClient
    .from('poll_responses')
    .select('poll_id')
    .eq('member_id', memberId)
    .in('poll_id', pollIds)

  const votedIds = new Set(responses?.map(r => r.poll_id) || [])

  return polls
    .filter(p => !votedIds.has(p.id))
    .slice(0, 3)
    .map(p => ({
      id: p.id,
      title: p.title,
      closes_at: p.closes_at,
      target_name: p.chapters?.name || null,
      question_count: p.poll_questions?.[0]?.count || 0,
    }))
}

async function getUnreadMessageCount(adminClient, teamMemberId) {
  // Get channels the team member belongs to with their last_read_at
  const { data: memberships } = await adminClient
    .from('channel_members')
    .select('channel_id, last_read_at')
    .eq('team_member_id', teamMemberId)

  if (!memberships || memberships.length === 0) return 0

  // Count messages newer than last_read_at across all channels
  let total = 0
  for (const m of memberships) {
    if (!m.last_read_at) continue
    const { count } = await adminClient
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', m.channel_id)
      .gt('created_at', m.last_read_at)
      .eq('is_deleted', false)

    total += count || 0
  }

  return total
}

async function getUpcomingShifts(adminClient, memberId, today) {
  const { data, error } = await adminClient
    .from('volunteer_applications')
    .select('id, status, volunteer_opportunities(id, title, event_date, start_time, end_time, location_name, is_remote)')
    .eq('member_id', memberId)
    .eq('status', 'approved')

  if (error || !data) return []

  // Filter to upcoming events and sort
  return data
    .filter(a => a.volunteer_opportunities?.event_date >= today)
    .sort((a, b) => (a.volunteer_opportunities.event_date || '').localeCompare(b.volunteer_opportunities.event_date || ''))
    .slice(0, 3)
    .map(a => a.volunteer_opportunities)
}
