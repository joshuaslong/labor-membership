import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST - Submit vote for all questions in a poll
export async function POST(request, { params }) {
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
      .select('id, status, target_type, chapter_id, group_id, results_visibility')
      .eq('id', id)
      .single()

    if (pollError || !poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
    }

    if (poll.status !== 'active') {
      return NextResponse.json({ error: 'This poll is not currently active' }, { status: 400 })
    }

    // Verify member has access
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

    // Check if member already voted
    const { data: existingVotes } = await adminClient
      .from('poll_responses')
      .select('id')
      .eq('poll_id', id)
      .eq('member_id', member.id)
      .limit(1)

    if (existingVotes && existingVotes.length > 0) {
      return NextResponse.json({ error: 'You have already voted in this poll' }, { status: 400 })
    }

    const body = await request.json()
    const { responses } = body

    if (!responses || !Array.isArray(responses) || responses.length === 0) {
      return NextResponse.json({ error: 'responses array is required' }, { status: 400 })
    }

    // Get all questions for this poll
    const { data: questions } = await adminClient
      .from('poll_questions')
      .select('id')
      .eq('poll_id', id)

    const questionIds = new Set(questions?.map(q => q.id) || [])

    // Validate all questions are answered
    const answeredQuestionIds = new Set(responses.map(r => r.question_id))
    for (const qId of questionIds) {
      if (!answeredQuestionIds.has(qId)) {
        return NextResponse.json({ error: 'All questions must be answered' }, { status: 400 })
      }
    }

    // Validate each response
    for (const r of responses) {
      if (!questionIds.has(r.question_id)) {
        return NextResponse.json({ error: 'Invalid question_id in responses' }, { status: 400 })
      }

      // Verify option belongs to question
      const { data: option } = await adminClient
        .from('poll_options')
        .select('id')
        .eq('id', r.option_id)
        .eq('question_id', r.question_id)
        .single()

      if (!option) {
        return NextResponse.json({ error: 'Invalid option_id for question' }, { status: 400 })
      }
    }

    // Insert all responses
    const rows = responses.map(r => ({
      poll_id: id,
      question_id: r.question_id,
      option_id: r.option_id,
      member_id: member.id,
    }))

    const { error: insertError } = await adminClient
      .from('poll_responses')
      .insert(rows)

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'You have already voted in this poll' }, { status: 400 })
      }
      throw insertError
    }

    // Return results if visibility is after_voting
    let results = null
    if (poll.results_visibility === 'after_voting') {
      const { data: resultRows } = await adminClient
        .rpc('get_poll_results', { poll_uuid: id })

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
        questions: Object.values(questionsMap),
      }
    }

    return NextResponse.json({
      success: true,
      results,
    })

  } catch (error) {
    console.error('Error submitting vote:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
