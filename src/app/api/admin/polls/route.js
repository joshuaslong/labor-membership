import { after } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendNewPollNotifications } from '@/lib/poll-notifications'

function getHighestRole(roles) {
  const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
  return roleHierarchy.find(r => roles.includes(r)) || null
}

async function verifyAdminAndJurisdiction(user, adminClient, chapterId) {
  const { data: teamMember } = await adminClient
    .from('team_members')
    .select('id, roles, chapter_id, is_media_team')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!teamMember) {
    return { error: 'Not an admin', status: 403 }
  }

  const highestRole = getHighestRole(teamMember.roles || [])
  if (!highestRole) {
    return { error: 'Not an admin', status: 403 }
  }

  const isSuperAdmin = ['super_admin', 'national_admin'].includes(highestRole)

  if (chapterId && !isSuperAdmin) {
    const { data: descendants } = await adminClient
      .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })
    const allowedChapterIds = descendants?.map(d => d.id) || []

    if (!allowedChapterIds.includes(chapterId) && teamMember.chapter_id !== chapterId) {
      return { error: 'You do not have access to this chapter', status: 403 }
    }
  }

  return { currentAdmin: teamMember, isSuperAdmin }
}

// GET - List polls
export async function GET(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const { data: teamMember } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id, is_media_team')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    if (!teamMember) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    const highestRole = getHighestRole(teamMember.roles || [])
    if (!highestRole) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    const isSuperAdmin = ['super_admin', 'national_admin'].includes(highestRole)

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')
    const chapterId = searchParams.get('chapterId')

    let query = adminClient
      .from('polls')
      .select('*, chapters(name, level), chapter_groups(name), poll_questions(count), poll_responses(count)')
      .order('created_at', { ascending: false })

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    if (chapterId) {
      query = query.eq('chapter_id', chapterId)
    } else if (!isSuperAdmin) {
      // Filter to admin's jurisdiction
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })
      const allowedChapterIds = descendants?.map(d => d.id) || []
      query = query.in('chapter_id', allowedChapterIds)
    }

    const { data: polls, error } = await query

    if (error) throw error

    const formatted = (polls || []).map(p => ({
      ...p,
      question_count: p.poll_questions?.[0]?.count || 0,
      response_count: p.poll_responses?.[0]?.count || 0,
      chapter_name: p.chapters?.name,
      chapter_level: p.chapters?.level,
      group_name: p.chapter_groups?.name || null,
      poll_questions: undefined,
      poll_responses: undefined,
      chapters: undefined,
      chapter_groups: undefined,
    }))

    return NextResponse.json({ polls: formatted })

  } catch (error) {
    console.error('Error fetching polls:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create a new poll with questions and options
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const body = await request.json()
    const { title, description, target_type, chapter_id, group_id, results_visibility, opens_at, closes_at, status, questions } = body

    if (!title || !chapter_id || !target_type) {
      return NextResponse.json({ error: 'title, chapter_id, and target_type are required' }, { status: 400 })
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ error: 'At least one question is required' }, { status: 400 })
    }

    for (const q of questions) {
      if (!q.question_text) {
        return NextResponse.json({ error: 'Each question must have question_text' }, { status: 400 })
      }
      if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
        return NextResponse.json({ error: 'Each question must have at least 2 options' }, { status: 400 })
      }
    }

    if (target_type === 'group' && !group_id) {
      return NextResponse.json({ error: 'group_id is required when target_type is group' }, { status: 400 })
    }

    // Verify admin and jurisdiction
    const result = await verifyAdminAndJurisdiction(user, adminClient, chapter_id)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    // If targeting a group, verify it belongs to the chapter
    if (target_type === 'group') {
      const { data: group, error: groupError } = await adminClient
        .from('chapter_groups')
        .select('id, chapter_id')
        .eq('id', group_id)
        .single()

      if (groupError || !group) {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 })
      }
      if (group.chapter_id !== chapter_id) {
        return NextResponse.json({ error: 'Group does not belong to the specified chapter' }, { status: 400 })
      }
    }

    // Create the poll
    const { data: poll, error: pollError } = await adminClient
      .from('polls')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        target_type,
        chapter_id,
        group_id: target_type === 'group' ? group_id : null,
        results_visibility: results_visibility || 'after_voting',
        opens_at: opens_at || null,
        closes_at: closes_at || null,
        status: status || 'draft',
        created_by: result.currentAdmin.id,
      })
      .select()
      .single()

    if (pollError) throw pollError

    // Create questions and options
    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi]
      const { data: question, error: qError } = await adminClient
        .from('poll_questions')
        .insert({
          poll_id: poll.id,
          question_text: q.question_text.trim(),
          display_order: q.display_order ?? qi,
        })
        .select()
        .single()

      if (qError) throw qError

      const optionRows = q.options.map((opt, oi) => ({
        question_id: question.id,
        option_text: opt.option_text.trim(),
        display_order: opt.display_order ?? oi,
      }))

      const { error: optError } = await adminClient
        .from('poll_options')
        .insert(optionRows)

      if (optError) throw optError
    }

    // Send notifications if poll is active
    if (poll.status === 'active') {
      after(async () => {
        try {
          await sendNewPollNotifications(poll)
        } catch (err) {
          console.error('Error sending new poll notifications:', err)
        }
      })
    }

    return NextResponse.json({ poll }, { status: 201 })

  } catch (error) {
    console.error('Error creating poll:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
