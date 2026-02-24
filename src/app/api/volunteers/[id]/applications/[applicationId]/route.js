import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PUT - Approve or reject a volunteer application
export async function PUT(request, { params }) {
  try {
    const { id, applicationId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get team member
    const { data: teamMember } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    if (!teamMember) {
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 })
    }

    // Get the opportunity to check chapter permission and workspace access grant
    const { data: opportunity } = await adminClient
      .from('volunteer_opportunities')
      .select('id, chapter_id, grants_workspace_access')
      .eq('id', id)
      .single()

    if (!opportunity) {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 })
    }

    // Check chapter permission
    const isTopAdmin = teamMember.roles.some(r => ['super_admin', 'national_admin'].includes(r))
    if (!isTopAdmin) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })
      const descendantIds = new Set((descendants || []).map(d => d.id))
      descendantIds.add(teamMember.chapter_id)

      if (!descendantIds.has(opportunity.chapter_id)) {
        return NextResponse.json({ error: 'You cannot manage applications for this opportunity' }, { status: 403 })
      }
    }

    // Get the application
    const { data: application } = await adminClient
      .from('volunteer_applications')
      .select('id, status')
      .eq('id', applicationId)
      .eq('opportunity_id', id)
      .single()

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const body = await request.json()
    const { status, admin_notes } = body

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Status must be approved or rejected' }, { status: 400 })
    }

    const { data: updated, error } = await adminClient
      .from('volunteer_applications')
      .update({
        status,
        admin_notes: admin_notes || null,
        reviewed_by: teamMember.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', applicationId)
      .select(`
        *,
        members (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .single()

    if (error) throw error

    // Auto-create team_member record when approved and opportunity grants workspace access
    if (status === 'approved' && opportunity?.grants_workspace_access) {
      // Get the applicant's user_id from their member record
      const { data: appWithMember } = await adminClient
        .from('volunteer_applications')
        .select('member_id, members(user_id)')
        .eq('id', applicationId)
        .single()

      if (appWithMember?.members?.user_id) {
        const userId = appWithMember.members.user_id

        // Check if team_member already exists
        const { data: existing } = await adminClient
          .from('team_members')
          .select('id, roles, active')
          .eq('user_id', userId)
          .single()

        if (existing) {
          // Reactivate and ensure team_member role is present
          const roles = existing.roles || []
          if (!roles.includes('team_member')) roles.push('team_member')
          await adminClient
            .from('team_members')
            .update({ roles, active: true, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
        } else {
          // Create new team_member
          await adminClient
            .from('team_members')
            .insert({
              user_id: userId,
              member_id: appWithMember.member_id,
              chapter_id: opportunity.chapter_id,
              roles: ['team_member'],
              active: true
            })
        }
      }
    }

    return NextResponse.json({ application: updated })

  } catch (error) {
    console.error('Error updating volunteer application:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
