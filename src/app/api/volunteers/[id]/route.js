import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendNewOpportunityNotification } from '@/lib/volunteer-notifications'

// GET - Single volunteer opportunity
export async function GET(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const adminClient = createAdminClient()

    const { data: opportunity, error } = await adminClient
      .from('volunteer_opportunities')
      .select(`
        *,
        chapters (id, name, level)
      `)
      .eq('id', id)
      .single()

    if (error || !opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    // Get application counts
    const { data: apps } = await adminClient
      .from('volunteer_applications')
      .select('id, status')
      .eq('opportunity_id', id)

    const counts = (apps || []).reduce((acc, app) => {
      acc.total++
      if (app.status === 'pending') acc.pending++
      if (app.status === 'approved') acc.approved++
      if (app.status === 'rejected') acc.rejected++
      return acc
    }, { total: 0, pending: 0, approved: 0, rejected: 0 })

    // Check user's application and skill match
    let userApplication = null
    let skillMatch = false
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: member } = await adminClient
        .from('members')
        .select('id, volunteer_skills')
        .eq('user_id', user.id)
        .single()

      if (member) {
        const { data: myApp } = await adminClient
          .from('volunteer_applications')
          .select('*')
          .eq('opportunity_id', id)
          .eq('member_id', member.id)
          .single()

        userApplication = myApp || null

        if (member.volunteer_skills) {
          const memberSkills = member.volunteer_skills
            .split(',')
            .map(s => s.trim().toUpperCase())
            .filter(Boolean)

          skillMatch = memberSkills.length > 0 && (opportunity.skills_needed || []).some(s =>
            memberSkills.some(ms => s.toUpperCase().includes(ms) || ms.includes(s.toUpperCase()))
          )
        }
      }
    }

    return NextResponse.json({
      opportunity: {
        ...opportunity,
        application_counts: counts,
        user_application: userApplication,
        skill_match: skillMatch,
        spots_remaining: opportunity.spots_available != null
          ? Math.max(0, opportunity.spots_available - counts.approved)
          : null
      }
    })

  } catch (error) {
    console.error('Error fetching volunteer opportunity:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update volunteer opportunity
export async function PUT(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const { data: teamMember } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    if (!teamMember) {
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 })
    }

    // Get existing opportunity
    const { data: existing } = await adminClient
      .from('volunteer_opportunities')
      .select('id, chapter_id, status')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    // Check chapter permission
    const isTopAdmin = teamMember.roles.some(r => ['super_admin', 'national_admin'].includes(r))
    if (!isTopAdmin) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })
      const descendantIds = new Set((descendants || []).map(d => d.id))
      descendantIds.add(teamMember.chapter_id)

      if (!descendantIds.has(existing.chapter_id)) {
        return NextResponse.json({ error: 'You cannot modify this opportunity' }, { status: 403 })
      }
    }

    const body = await request.json()
    const updateData = {}
    const allowedFields = [
      'title', 'description', 'opportunity_type', 'status', 'chapter_id',
      'event_date', 'start_time', 'end_time',
      'location_name', 'is_remote',
      'skills_needed', 'spots_available', 'time_commitment', 'deadline'
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }

    const { data: updated, error } = await adminClient
      .from('volunteer_opportunities')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Send notifications if status changed to published
    if (updated.status === 'published' && existing.status !== 'published') {
      sendNewOpportunityNotification(updated).catch(err => {
        console.error('Error sending volunteer notifications:', err)
      })
    }

    return NextResponse.json({ opportunity: updated })

  } catch (error) {
    console.error('Error updating volunteer opportunity:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete volunteer opportunity
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const { data: teamMember } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    if (!teamMember) {
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 })
    }

    const { data: existing } = await adminClient
      .from('volunteer_opportunities')
      .select('id, chapter_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    // Check chapter permission
    const isTopAdmin = teamMember.roles.some(r => ['super_admin', 'national_admin'].includes(r))
    if (!isTopAdmin) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })
      const descendantIds = new Set((descendants || []).map(d => d.id))
      descendantIds.add(teamMember.chapter_id)

      if (!descendantIds.has(existing.chapter_id)) {
        return NextResponse.json({ error: 'You cannot delete this opportunity' }, { status: 403 })
      }
    }

    const { error } = await adminClient
      .from('volunteer_opportunities')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting volunteer opportunity:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
