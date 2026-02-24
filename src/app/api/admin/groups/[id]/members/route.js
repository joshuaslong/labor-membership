import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function getGroupWithAccess(user, adminClient, groupId) {
  const { data: teamMember } = await adminClient
    .from('team_members')
    .select('id, roles, chapter_id, is_media_team')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (!teamMember) {
    return { error: 'Not an admin', status: 403 }
  }

  const { data: group, error: groupError } = await adminClient
    .from('chapter_groups')
    .select('id, chapter_id, name')
    .eq('id', groupId)
    .single()

  if (groupError || !group) {
    return { error: 'Group not found', status: 404 }
  }

  const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
  const highestRole = roleHierarchy.find(r => (teamMember.roles || []).includes(r)) || null

  if (!highestRole) {
    return { error: 'Not an admin', status: 403 }
  }

  const isSuperAdmin = ['super_admin', 'national_admin'].includes(highestRole)

  if (!isSuperAdmin) {
    const { data: descendants } = await adminClient
      .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })
    const allowedChapterIds = descendants?.map(d => d.id) || []

    if (!allowedChapterIds.includes(group.chapter_id) && teamMember.chapter_id !== group.chapter_id) {
      return { error: 'You do not have access to this group', status: 403 }
    }
  }

  return { group }
}

// GET - List members in a group
export async function GET(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const result = await getGroupWithAccess(user, adminClient, id)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

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

    return NextResponse.json({ members })

  } catch (error) {
    console.error('Error fetching group members:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Add members to a group
export async function POST(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const result = await getGroupWithAccess(user, adminClient, id)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const body = await request.json()
    const { memberIds } = body

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json({ error: 'memberIds array is required' }, { status: 400 })
    }

    // Verify members belong to the group's chapter
    const { data: validMembers } = await adminClient
      .from('member_chapters')
      .select('member_id')
      .eq('chapter_id', result.group.chapter_id)
      .in('member_id', memberIds)

    const validMemberIds = (validMembers || []).map(m => m.member_id)

    if (validMemberIds.length === 0) {
      return NextResponse.json({ error: 'None of the specified members belong to this chapter' }, { status: 400 })
    }

    // Insert assignments, ignore duplicates
    const rows = validMemberIds.map(memberId => ({
      member_id: memberId,
      group_id: id,
      assigned_by: user.id,
    }))

    const { error } = await adminClient
      .from('member_group_assignments')
      .upsert(rows, { onConflict: 'member_id,group_id', ignoreDuplicates: true })

    if (error) throw error

    return NextResponse.json({ added: validMemberIds.length })

  } catch (error) {
    console.error('Error adding group members:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Remove members from a group
export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const result = await getGroupWithAccess(user, adminClient, id)

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const body = await request.json()
    const { memberIds } = body

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json({ error: 'memberIds array is required' }, { status: 400 })
    }

    const { error } = await adminClient
      .from('member_group_assignments')
      .delete()
      .eq('group_id', id)
      .in('member_id', memberIds)

    if (error) throw error

    return NextResponse.json({ removed: memberIds.length })

  } catch (error) {
    console.error('Error removing group members:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
