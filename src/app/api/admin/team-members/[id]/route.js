import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - Get a single team member
export async function GET(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check caller has admin access
    const { data: caller } = await supabase
      .from('team_members')
      .select('id, roles')
      .eq('user_id', user.id)
      .single()

    if (!caller) {
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 })
    }

    const isTopAdmin = caller.roles.includes('super_admin') || caller.roles.includes('national_admin')
    if (!isTopAdmin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    const { data: teamMember, error } = await adminClient
      .from('team_members')
      .select(`
        id,
        user_id,
        member_id,
        roles,
        active,
        chapter_id,
        created_at,
        updated_at,
        member:members(id, first_name, last_name, email),
        chapter:chapters(id, name, level)
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    // Backfill member info via user_id if member_id is null
    if (!teamMember.member && teamMember.user_id) {
      const { data: memberByUser } = await adminClient
        .from('members')
        .select('id, first_name, last_name, email')
        .eq('user_id', teamMember.user_id)
        .single()

      if (memberByUser) {
        teamMember.member = memberByUser
      }
    }

    return NextResponse.json({ teamMember })
  } catch (error) {
    console.error('Error fetching team member:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update a team member
export async function PUT(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: caller } = await supabase
      .from('team_members')
      .select('id, roles')
      .eq('user_id', user.id)
      .single()

    if (!caller) {
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 })
    }

    const isTopAdmin = caller.roles.includes('super_admin') || caller.roles.includes('national_admin')
    if (!isTopAdmin) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { roles, chapter_id, active } = body

    const adminClient = createAdminClient()

    // Get current team member to check constraints
    const { data: target } = await adminClient
      .from('team_members')
      .select('id, roles, user_id')
      .eq('id', id)
      .single()

    if (!target) {
      return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
    }

    // Prevent removing super_admin from yourself
    if (target.user_id === user.id && roles && !roles.includes('super_admin') && target.roles.includes('super_admin')) {
      return NextResponse.json({ error: 'Cannot remove super admin role from yourself' }, { status: 400 })
    }

    // Only super_admin can assign/modify super_admin role
    if (roles && roles.includes('super_admin') && !caller.roles.includes('super_admin')) {
      return NextResponse.json({ error: 'Only super admins can assign the super admin role' }, { status: 403 })
    }

    const updates = {}
    if (roles !== undefined) updates.roles = roles
    if (chapter_id !== undefined) updates.chapter_id = chapter_id || null
    if (active !== undefined) updates.active = active

    const { data: teamMember, error } = await adminClient
      .from('team_members')
      .update(updates)
      .eq('id', id)
      .select(`
        id,
        user_id,
        member_id,
        roles,
        active,
        chapter_id,
        created_at,
        updated_at,
        member:members(id, first_name, last_name, email),
        chapter:chapters(id, name, level)
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ teamMember })
  } catch (error) {
    console.error('Error updating team member:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Remove a team member
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: caller } = await supabase
      .from('team_members')
      .select('id, roles')
      .eq('user_id', user.id)
      .single()

    if (!caller) {
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 })
    }

    const isSuperAdmin = caller.roles.includes('super_admin')
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Only super admins can remove team members' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Prevent deleting yourself
    const { data: target } = await adminClient
      .from('team_members')
      .select('user_id')
      .eq('id', id)
      .single()

    if (target?.user_id === user.id) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
    }

    const { error } = await adminClient
      .from('team_members')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting team member:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
