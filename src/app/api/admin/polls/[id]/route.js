import { after } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendNewPollNotifications } from '@/lib/poll-notifications'
import { hasReminderBeenSent } from '@/lib/email-templates'

async function verifyPollAccess(user, adminClient, pollId) {
  const { data: adminRecords } = await adminClient
    .from('admin_users')
    .select('id, role, chapter_id')
    .eq('user_id', user.id)

  if (!adminRecords || adminRecords.length === 0) {
    return { error: 'Not an admin', status: 403 }
  }

  const { data: poll, error: pollError } = await adminClient
    .from('polls')
    .select('*, chapters(name, level), chapter_groups(name)')
    .eq('id', pollId)
    .single()

  if (pollError || !poll) {
    return { error: 'Poll not found', status: 404 }
  }

  const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
  const currentAdmin = adminRecords.reduce((highest, current) => {
    const currentIndex = roleHierarchy.indexOf(current.role)
    const highestIndex = roleHierarchy.indexOf(highest.role)
    return currentIndex < highestIndex ? current : highest
  }, adminRecords[0])

  const isSuperAdmin = ['super_admin', 'national_admin'].includes(currentAdmin.role)

  if (!isSuperAdmin) {
    const { data: descendants } = await adminClient
      .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })
    const allowedChapterIds = descendants?.map(d => d.id) || []

    if (!allowedChapterIds.includes(poll.chapter_id) && currentAdmin.chapter_id !== poll.chapter_id) {
      return { error: 'You do not have access to this poll', status: 403 }
    }
  }

  return { poll, currentAdmin }
}

// GET - Get a single poll with questions, options, and response counts
export async function GET(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const result = await verifyPollAccess(user, adminClient, id)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    // Get questions with options
    const { data: questions, error: qError } = await adminClient
      .from('poll_questions')
      .select('*, poll_options(*)')
      .eq('poll_id', id)
      .order('display_order')

    if (qError) throw qError

    // Sort options within each question
    const sortedQuestions = (questions || []).map(q => ({
      ...q,
      options: (q.poll_options || []).sort((a, b) => a.display_order - b.display_order),
      poll_options: undefined,
    }))

    // Get response count
    const { count: responseCount } = await adminClient
      .from('poll_responses')
      .select('member_id', { count: 'exact', head: true })
      .eq('poll_id', id)

    // Get unique voter count
    const { data: voters } = await adminClient
      .from('poll_responses')
      .select('member_id')
      .eq('poll_id', id)

    const uniqueVoters = new Set(voters?.map(v => v.member_id) || []).size

    return NextResponse.json({
      poll: result.poll,
      questions: sortedQuestions,
      total_voters: uniqueVoters,
    })

  } catch (error) {
    console.error('Error fetching poll:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update poll metadata/status
export async function PUT(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const result = await verifyPollAccess(user, adminClient, id)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const body = await request.json()
    const { title, description, status, results_visibility, opens_at, closes_at, questions } = body

    // Validate status transitions
    if (status) {
      const validTransitions = {
        draft: ['active'],
        active: ['closed'],
        closed: ['archived'],
        archived: [],
      }
      const allowed = validTransitions[result.poll.status] || []
      if (status !== result.poll.status && !allowed.includes(status)) {
        return NextResponse.json({
          error: `Cannot change status from ${result.poll.status} to ${status}`
        }, { status: 400 })
      }
    }

    // Update poll metadata
    const updates = {}
    if (title !== undefined) updates.title = title.trim()
    if (description !== undefined) updates.description = description?.trim() || null
    if (status !== undefined) updates.status = status
    if (results_visibility !== undefined) updates.results_visibility = results_visibility
    if (opens_at !== undefined) updates.opens_at = opens_at || null
    if (closes_at !== undefined) updates.closes_at = closes_at || null

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await adminClient
        .from('polls')
        .update(updates)
        .eq('id', id)

      if (updateError) throw updateError
    }

    // Update questions/options only if poll is still in draft
    if (questions && result.poll.status === 'draft') {
      // Delete existing questions (cascade deletes options)
      await adminClient
        .from('poll_questions')
        .delete()
        .eq('poll_id', id)

      // Re-create questions and options
      for (let qi = 0; qi < questions.length; qi++) {
        const q = questions[qi]
        const { data: question, error: qError } = await adminClient
          .from('poll_questions')
          .insert({
            poll_id: id,
            question_text: q.question_text.trim(),
            display_order: q.display_order ?? qi,
          })
          .select()
          .single()

        if (qError) throw qError

        const optionRows = (q.options || []).map((opt, oi) => ({
          question_id: question.id,
          option_text: opt.option_text.trim(),
          display_order: opt.display_order ?? oi,
        }))

        if (optionRows.length > 0) {
          const { error: optError } = await adminClient
            .from('poll_options')
            .insert(optionRows)

          if (optError) throw optError
        }
      }
    } else if (questions && result.poll.status !== 'draft') {
      return NextResponse.json({
        error: 'Questions cannot be edited after a poll becomes active'
      }, { status: 400 })
    }

    // Fetch updated poll
    const { data: updatedPoll } = await adminClient
      .from('polls')
      .select('*, chapters(name, level), chapter_groups(name)')
      .eq('id', id)
      .single()

    // Send notifications if poll was just activated
    if (status === 'active' && result.poll.status !== 'active' && updatedPoll) {
      after(async () => {
        try {
          await sendNewPollNotifications(updatedPoll)
        } catch (err) {
          console.error('Error sending new poll notifications:', err)
        }
      })
    }

    return NextResponse.json({ poll: updatedPoll })

  } catch (error) {
    console.error('Error updating poll:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete a draft poll
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const result = await verifyPollAccess(user, adminClient, id)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    if (result.poll.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft polls can be deleted' }, { status: 400 })
    }

    const { error } = await adminClient
      .from('polls')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting poll:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
