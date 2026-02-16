import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sendNewOpportunityNotification } from '@/lib/volunteer-notifications'

// GET - List volunteer opportunities
export async function GET(request) {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status') || 'published'
    const type = searchParams.get('type')
    const skill = searchParams.get('skill')
    const search = searchParams.get('search')
    const chapterId = searchParams.get('chapter_id')

    let query = adminClient
      .from('volunteer_opportunities')
      .select(`
        id,
        title,
        description,
        opportunity_type,
        status,
        event_date,
        start_time,
        end_time,
        location_name,
        is_remote,
        skills_needed,
        spots_available,
        time_commitment,
        deadline,
        chapter_id,
        created_at,
        chapters (
          id,
          name,
          level
        )
      `)
      .order('created_at', { ascending: false })

    if (status !== 'all') query = query.eq('status', status)
    if (type) query = query.eq('opportunity_type', type)
    if (chapterId) query = query.eq('chapter_id', chapterId)
    if (search) query = query.ilike('title', `%${search}%`)
    if (skill) query = query.contains('skills_needed', [skill])

    const { data: opportunities, error } = await query

    if (error) throw error

    // Get application counts for each opportunity
    const oppIds = (opportunities || []).map(o => o.id)
    let appCounts = {}
    if (oppIds.length > 0) {
      const { data: apps } = await adminClient
        .from('volunteer_applications')
        .select('opportunity_id, status')
        .in('opportunity_id', oppIds)

      appCounts = (apps || []).reduce((acc, app) => {
        if (!acc[app.opportunity_id]) acc[app.opportunity_id] = { pending: 0, approved: 0, total: 0 }
        acc[app.opportunity_id].total++
        if (app.status === 'pending') acc[app.opportunity_id].pending++
        if (app.status === 'approved') acc[app.opportunity_id].approved++
        return acc
      }, {})
    }

    // Check logged-in user's applications and skill match
    let userApplications = {}
    let memberSkills = []
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: member } = await adminClient
        .from('members')
        .select('id, volunteer_skills')
        .eq('user_id', user.id)
        .single()

      if (member) {
        // Get user's applications
        const { data: myApps } = await adminClient
          .from('volunteer_applications')
          .select('opportunity_id, status')
          .eq('member_id', member.id)
          .in('opportunity_id', oppIds)

        userApplications = (myApps || []).reduce((acc, app) => {
          acc[app.opportunity_id] = app.status
          return acc
        }, {})

        // Parse member skills for matching
        if (member.volunteer_skills) {
          memberSkills = member.volunteer_skills
            .split(',')
            .map(s => s.trim().toUpperCase())
            .filter(Boolean)
        }
      }
    }

    // Enrich opportunities
    const enriched = (opportunities || []).map(opp => {
      const counts = appCounts[opp.id] || { pending: 0, approved: 0, total: 0 }
      const skillMatch = memberSkills.length > 0 && (opp.skills_needed || []).some(s =>
        memberSkills.some(ms => s.toUpperCase().includes(ms) || ms.includes(s.toUpperCase()))
      )

      return {
        ...opp,
        application_counts: counts,
        user_application_status: userApplications[opp.id] || null,
        skill_match: skillMatch,
        spots_remaining: opp.spots_available != null
          ? Math.max(0, opp.spots_available - counts.approved)
          : null
      }
    })

    return NextResponse.json({ opportunities: enriched })

  } catch (error) {
    console.error('Error fetching volunteer opportunities:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create a volunteer opportunity
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get team member for permission check
    const { data: teamMember } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    if (!teamMember) {
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 })
    }

    const body = await request.json()
    const {
      title, description, opportunity_type, chapter_id,
      event_date, start_time, end_time,
      location_name, is_remote,
      skills_needed, spots_available, time_commitment, deadline,
      status
    } = body

    if (!title || !description || !opportunity_type || !chapter_id) {
      return NextResponse.json({ error: 'Title, description, type, and chapter are required' }, { status: 400 })
    }

    if (opportunity_type === 'one_time' && !event_date) {
      return NextResponse.json({ error: 'Event date is required for one-time opportunities' }, { status: 400 })
    }

    // Check chapter permission for non-super/national admins
    const isTopAdmin = teamMember.roles.some(r => ['super_admin', 'national_admin'].includes(r))
    if (!isTopAdmin) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })
      const descendantIds = new Set((descendants || []).map(d => d.id))
      descendantIds.add(teamMember.chapter_id)

      if (!descendantIds.has(chapter_id)) {
        return NextResponse.json({ error: 'You cannot create opportunities for this chapter' }, { status: 403 })
      }
    }

    const { data: opportunity, error } = await adminClient
      .from('volunteer_opportunities')
      .insert({
        title,
        description,
        opportunity_type,
        chapter_id,
        created_by: teamMember.id,
        event_date: event_date || null,
        start_time: start_time || null,
        end_time: end_time || null,
        location_name: location_name || null,
        is_remote: is_remote || false,
        skills_needed: skills_needed || [],
        spots_available: spots_available || null,
        time_commitment: time_commitment || null,
        deadline: deadline || null,
        status: status || 'draft'
      })
      .select()
      .single()

    if (error) throw error

    // Send notifications if published immediately
    if (opportunity.status === 'published') {
      sendNewOpportunityNotification(opportunity).catch(err => {
        console.error('Error sending volunteer notifications:', err)
      })
    }

    return NextResponse.json({ opportunity }, { status: 201 })

  } catch (error) {
    console.error('Error creating volunteer opportunity:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
