import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - List applications for a volunteer opportunity (admin only)
export async function GET(request, { params }) {
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

    // Check opportunity exists and admin has access
    const { data: opportunity } = await adminClient
      .from('volunteer_opportunities')
      .select('id, chapter_id')
      .eq('id', id)
      .single()

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    const isTopAdmin = teamMember.roles.some(r => ['super_admin', 'national_admin'].includes(r))
    if (!isTopAdmin) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })
      const descendantIds = new Set((descendants || []).map(d => d.id))
      descendantIds.add(teamMember.chapter_id)

      if (!descendantIds.has(opportunity.chapter_id)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    const { data: applications, error } = await adminClient
      .from('volunteer_applications')
      .select(`
        *,
        members (
          id,
          first_name,
          last_name,
          email,
          volunteer_skills
        )
      `)
      .eq('opportunity_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ applications: applications || [] })

  } catch (error) {
    console.error('Error fetching volunteer applications:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
