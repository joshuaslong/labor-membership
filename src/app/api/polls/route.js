import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - List active polls for the authenticated member
export async function GET() {
  try {
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

    // Get member's chapter IDs
    const { data: memberChapters } = await adminClient
      .from('member_chapters')
      .select('chapter_id')
      .eq('member_id', member.id)

    const chapterIds = memberChapters?.map(mc => mc.chapter_id) || []

    // Get member's group IDs
    const { data: memberGroups } = await adminClient
      .from('member_group_assignments')
      .select('group_id')
      .eq('member_id', member.id)

    const groupIds = memberGroups?.map(mg => mg.group_id) || []

    // Find active/closed polls targeting member's chapters or groups
    let polls = []

    if (chapterIds.length > 0) {
      const { data: chapterPolls } = await adminClient
        .from('polls')
        .select('*, chapters(name), poll_questions(count)')
        .in('status', ['active', 'closed'])
        .eq('target_type', 'chapter')
        .in('chapter_id', chapterIds)
        .order('created_at', { ascending: false })

      if (chapterPolls) polls.push(...chapterPolls)
    }

    if (groupIds.length > 0) {
      const { data: groupPolls } = await adminClient
        .from('polls')
        .select('*, chapter_groups(name), poll_questions(count)')
        .in('status', ['active', 'closed'])
        .eq('target_type', 'group')
        .in('group_id', groupIds)
        .order('created_at', { ascending: false })

      if (groupPolls) polls.push(...groupPolls)
    }

    // Sort by created_at descending
    polls.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    // Check which polls the member has already voted in
    const pollIds = polls.map(p => p.id)
    let votedPollIds = new Set()

    if (pollIds.length > 0) {
      const { data: responses } = await adminClient
        .from('poll_responses')
        .select('poll_id')
        .eq('member_id', member.id)
        .in('poll_id', pollIds)

      votedPollIds = new Set(responses?.map(r => r.poll_id) || [])
    }

    const formatted = polls.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      status: p.status,
      target_type: p.target_type,
      results_visibility: p.results_visibility,
      closes_at: p.closes_at,
      created_at: p.created_at,
      question_count: p.poll_questions?.[0]?.count || 0,
      target_name: p.chapters?.name || p.chapter_groups?.name || null,
      has_voted: votedPollIds.has(p.id),
    }))

    return NextResponse.json({ polls: formatted })

  } catch (error) {
    console.error('Error fetching polls:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
