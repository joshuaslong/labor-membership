import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Get detailed tracked results for a poll
export async function GET(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Verify admin
    const { data: teamMember } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id, is_media_team')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    if (!teamMember) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    // Get poll
    const { data: poll, error: pollError } = await adminClient
      .from('polls')
      .select('*, chapters(name, level), chapter_groups(name)')
      .eq('id', id)
      .single()

    if (pollError || !poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
    }

    // Check jurisdiction
    const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
    const highestRole = roleHierarchy.find(r => (teamMember.roles || []).includes(r)) || null

    if (!highestRole) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    const isSuperAdmin = ['super_admin', 'national_admin'].includes(highestRole)

    if (!isSuperAdmin) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })
      const allowedChapterIds = descendants?.map(d => d.id) || []

      if (!allowedChapterIds.includes(poll.chapter_id) && teamMember.chapter_id !== poll.chapter_id) {
        return NextResponse.json({ error: 'You do not have access to this poll' }, { status: 403 })
      }
    }

    // Get aggregate results via helper function
    const { data: resultRows, error: resultError } = await adminClient
      .rpc('get_poll_results', { poll_uuid: id })

    if (resultError) throw resultError

    // Get all responses with member info for tracked voting
    const { data: responses, error: respError } = await adminClient
      .from('poll_responses')
      .select('question_id, option_id, member_id, created_at, members(first_name, last_name, email)')
      .eq('poll_id', id)
      .order('created_at', { ascending: false })

    if (respError) throw respError

    // Calculate total eligible members
    let totalEligible = 0
    if (poll.target_type === 'chapter') {
      const { count } = await adminClient
        .from('member_chapters')
        .select('member_id', { count: 'exact', head: true })
        .eq('chapter_id', poll.chapter_id)
      totalEligible = count || 0
    } else {
      const { count } = await adminClient
        .from('member_group_assignments')
        .select('member_id', { count: 'exact', head: true })
        .eq('group_id', poll.group_id)
      totalEligible = count || 0
    }

    // Get unique voter count
    const uniqueVoterIds = new Set(responses?.map(r => r.member_id) || [])
    const totalVoters = uniqueVoterIds.size

    // Build structured results by question
    const questionsMap = {}
    for (const row of (resultRows || [])) {
      if (!questionsMap[row.question_id]) {
        questionsMap[row.question_id] = {
          id: row.question_id,
          question_text: row.question_text,
          display_order: row.display_order,
          options: [],
        }
      }

      // Get voters for this option
      const optionVoters = (responses || [])
        .filter(r => r.option_id === row.option_id)
        .map(r => ({
          member_id: r.member_id,
          first_name: r.members?.first_name,
          last_name: r.members?.last_name,
          email: r.members?.email,
          voted_at: r.created_at,
        }))

      questionsMap[row.question_id].options.push({
        id: row.option_id,
        option_text: row.option_text,
        display_order: row.option_order,
        vote_count: Number(row.vote_count),
        percentage: totalVoters > 0 ? Math.round((Number(row.vote_count) / totalVoters) * 1000) / 10 : 0,
        voters: optionVoters,
      })
    }

    const questions = Object.values(questionsMap).sort((a, b) => a.display_order - b.display_order)

    return NextResponse.json({
      poll,
      total_eligible: totalEligible,
      total_voters: totalVoters,
      response_rate: totalEligible > 0 ? Math.round((totalVoters / totalEligible) * 1000) / 10 : 0,
      questions,
    })

  } catch (error) {
    console.error('Error fetching poll results:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
