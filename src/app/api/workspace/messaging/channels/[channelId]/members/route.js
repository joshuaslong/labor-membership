import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { getEffectiveChapterScope, resolveChapterIds } from '@/lib/chapterScope'
import { isAdmin } from '@/lib/permissions'

export async function GET(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { channelId } = await params
  const supabase = createAdminClient()

  // Verify requesting user is a member of this channel
  const { data: selfMembership } = await supabase
    .from('channel_members')
    .select('id')
    .eq('channel_id', channelId)
    .eq('team_member_id', teamMember.id)
    .single()

  if (!selfMembership) {
    return NextResponse.json({ error: 'You must be a channel member to view members' }, { status: 403 })
  }

  const { data: members, error } = await supabase
    .from('channel_members')
    .select(`
      id, role, joined_at,
      team_members(id, member_id, roles,
        members(first_name, last_name)
      )
    `)
    .eq('channel_id', channelId)
    .order('joined_at')

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
  }

  const result = members.map(m => ({
    id: m.id,
    role: m.role,
    joined_at: m.joined_at,
    team_member_id: m.team_members?.id,
    first_name: m.team_members?.members?.first_name ?? null,
    last_name: m.team_members?.members?.last_name ?? null,
  }))

  return NextResponse.json(result)
}

export async function POST(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { channelId } = await params
  const supabase = createAdminClient()

  // Get the channel
  const { data: channel } = await supabase
    .from('channels')
    .select('id, chapter_id, is_private')
    .eq('id', channelId)
    .single()

  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
  }

  // Parse body — if team_member_ids is provided, this is an admin adding members
  let body = {}
  try { body = await request.json() } catch { /* empty body = self-join */ }
  const { team_member_ids } = body

  if (Array.isArray(team_member_ids) && team_member_ids.length > 0) {
    // Admin adding members to a channel
    const callerMembership = await supabase
      .from('channel_members')
      .select('role')
      .eq('channel_id', channelId)
      .eq('team_member_id', teamMember.id)
      .single()

    const isChannelAdmin = callerMembership.data?.role === 'admin'
    const isChapterAdmin = isAdmin(teamMember.roles)

    if (!isChannelAdmin && !isChapterAdmin) {
      return NextResponse.json({ error: 'Only channel or chapter admins can add members' }, { status: 403 })
    }

    // Filter out already-existing members
    const { data: existingMembers } = await supabase
      .from('channel_members')
      .select('team_member_id')
      .eq('channel_id', channelId)
      .in('team_member_id', team_member_ids)

    const existingIds = new Set((existingMembers || []).map(m => m.team_member_id))
    const newIds = team_member_ids.filter(id => !existingIds.has(id))

    if (newIds.length === 0) {
      return NextResponse.json({ error: 'All selected members are already in this channel' }, { status: 400 })
    }

    const rows = newIds.map(tmId => ({
      channel_id: channelId,
      team_member_id: tmId,
      role: 'member',
    }))

    const { error } = await supabase.from('channel_members').insert(rows)
    if (error) {
      return NextResponse.json({ error: 'Failed to add members' }, { status: 500 })
    }

    return NextResponse.json({ added: newIds.length }, { status: 201 })
  }

  // Self-join flow
  // Private channels cannot be self-joined
  if (channel.is_private) {
    return NextResponse.json({ error: 'Private channels require an invite' }, { status: 403 })
  }

  // Validate channel's chapter is accessible to the user
  const scope = await getEffectiveChapterScope(teamMember)
  const chapterIds = await resolveChapterIds(scope, supabase)

  if (chapterIds && !chapterIds.includes(channel.chapter_id)) {
    return NextResponse.json({ error: 'Channel is not in your accessible chapters' }, { status: 403 })
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('channel_members')
    .select('id')
    .eq('channel_id', channelId)
    .eq('team_member_id', teamMember.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Already a member of this channel' }, { status: 400 })
  }

  const { data: membership, error } = await supabase
    .from('channel_members')
    .insert({
      channel_id: channelId,
      team_member_id: teamMember.id,
      role: 'member',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to join channel' }, { status: 500 })
  }

  return NextResponse.json(membership, { status: 201 })
}

export async function DELETE(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { channelId } = await params
  const supabase = createAdminClient()

  // Find the user's membership
  const { data: membership } = await supabase
    .from('channel_members')
    .select('id, role')
    .eq('channel_id', channelId)
    .eq('team_member_id', teamMember.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this channel' }, { status: 400 })
  }

  // If they're an admin, check they're not the last admin
  if (membership.role === 'admin') {
    const { count } = await supabase
      .from('channel_members')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', channelId)
      .eq('role', 'admin')

    if (count <= 1) {
      return NextResponse.json({ error: 'Cannot leave — you are the last admin' }, { status: 400 })
    }
  }

  const { error } = await supabase
    .from('channel_members')
    .delete()
    .eq('id', membership.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to leave channel' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
