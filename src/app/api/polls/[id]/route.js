import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Get poll detail for a member (with questions, options, and possibly results)
export async function GET(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get member record
    const { data: member } = await adminClient
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Get the poll
    const { data: poll, error: pollError } = await adminClient
      .from('polls')
      .select('*, chapters(name), chapter_groups(name)')
      .eq('id', id)
      .in('status', ['active', 'closed'])
      .single()

    if (pollError || !poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
    }

    // Verify member has access to this poll
    let hasAccess = false
    if (poll.target_type === 'chapter') {
      const { data: mc } = await adminClient
        .from('member_chapters')
        .select('id')
        .eq('member_id', member.id)
        .eq('chapter_id', poll.chapter_id)
        .limit(1)
      hasAccess = mc && mc.length > 0
    } else {
      const { data: mga } = await adminClient
        .from('member_group_assignments')
        .select('id')
        .eq('member_id', member.id)
        .eq('group_id', poll.group_id)
        .limit(1)
      hasAccess = mga && mga.length > 0
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to this poll' }, { status: 403 })
    }

    // Get questions with options
    const { data: questions, error: qError } = await adminClient
      .from('poll_questions')
      .select('id, question_text, display_order, poll_options(id, option_text, display_order)')
      .eq('poll_id', id)
      .order('display_order')

    if (qError) throw qError

    const sortedQuestions = (questions || []).map(q => ({
      id: q.id,
      question_text: q.question_text,
      display_order: q.display_order,
      options: (q.poll_options || []).sort((a, b) => a.display_order - b.display_order),
    }))

    // Check if member has voted
    const { data: myResponses } = await adminClient
      .from('poll_responses')
      .select('question_id, option_id, created_at')
      .eq('poll_id', id)
      .eq('member_id', member.id)

    const hasVoted = myResponses && myResponses.length > 0

    // Determine if we should show results
    let results = null
    const shouldShowResults =
      (hasVoted && poll.results_visibility === 'after_voting') ||
      (poll.status === 'closed')

    if (shouldShowResults) {
      const { data: resultRows } = await adminClient
        .rpc('get_poll_results', { poll_uuid: id })

      // Get unique voter count
      const { data: allResponses } = await adminClient
        .from('poll_responses')
        .select('member_id')
        .eq('poll_id', id)

      const totalVoters = new Set(allResponses?.map(r => r.member_id) || []).size

      const questionsMap = {}
      for (const row of (resultRows || [])) {
        if (!questionsMap[row.question_id]) {
          questionsMap[row.question_id] = {
            id: row.question_id,
            question_text: row.question_text,
            options: [],
          }
        }
        questionsMap[row.question_id].options.push({
          id: row.option_id,
          option_text: row.option_text,
          vote_count: Number(row.vote_count),
          percentage: totalVoters > 0 ? Math.round((Number(row.vote_count) / totalVoters) * 1000) / 10 : 0,
        })
      }

      results = {
        total_voters: totalVoters,
        questions: Object.values(questionsMap).sort((a, b) => {
          const aOrder = sortedQuestions.find(q => q.id === a.id)?.display_order || 0
          const bOrder = sortedQuestions.find(q => q.id === b.id)?.display_order || 0
          return aOrder - bOrder
        }),
      }
    }

    return NextResponse.json({
      poll: {
        id: poll.id,
        title: poll.title,
        description: poll.description,
        status: poll.status,
        target_type: poll.target_type,
        results_visibility: poll.results_visibility,
        closes_at: poll.closes_at,
        target_name: poll.chapters?.name || poll.chapter_groups?.name || null,
      },
      questions: sortedQuestions,
      has_voted: hasVoted,
      my_responses: hasVoted ? myResponses : null,
      results,
    })

  } catch (error) {
    console.error('Error fetching poll:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
