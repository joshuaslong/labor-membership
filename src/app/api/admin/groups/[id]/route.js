import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function verifyGroupAccess(user, adminClient, groupId) {
  const { data: adminRecords } = await adminClient
    .from('admin_users')
    .select('id, role, chapter_id')
    .eq('user_id', user.id)

  if (!adminRecords || adminRecords.length === 0) {
    return { error: 'Not an admin', status: 403 }
  }

  const { data: group, error: groupError } = await adminClient
    .from('chapter_groups')
    .select('*, chapters(name)')
    .eq('id', groupId)
    .single()

  if (groupError || !group) {
    return { error: 'Group not found', status: 404 }
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

    if (!allowedChapterIds.includes(group.chapter_id) && currentAdmin.chapter_id !== group.chapter_id) {
      return { error: 'You do not have access to this group', status: 403 }
    }
  }

  return { group }
}

// GET - Get a single group with its members
export async function GET(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const result = await verifyGroupAccess(user, adminClient, id)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    // Get members in this group
    const { data: assignments, error } = await adminClient
      .from('member_group_assignments')
      .select('id, assigned_at, members(id, first_name, last_name, email, status)')
      .eq('group_id', id)
      .order('assigned_at', { ascending: false })

    if (error) throw error

    const members = (assignments || []).map(a => ({
      assignment_id: a.id,
      assigned_at: a.assigned_at,
      ...a.members,
    }))

    return NextResponse.json({ group: result.group, members })

  } catch (error) {
    console.error('Error fetching group:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update a group
export async function PUT(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const result = await verifyGroupAccess(user, adminClient, id)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const body = await request.json()
    const { name, description } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const { data: group, error } = await adminClient
      .from('chapter_groups')
      .update({
        name: name.trim(),
        description: description?.trim() || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A group with this name already exists in this chapter' }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json({ group })

  } catch (error) {
    console.error('Error updating group:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete a group
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const result = await verifyGroupAccess(user, adminClient, id)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { error } = await adminClient
      .from('chapter_groups')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting group:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
