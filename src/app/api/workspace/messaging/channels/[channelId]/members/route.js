import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { getEffectiveChapterScope, resolveChapterIds } from '@/lib/chapterScope'

export async function GET(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { channelId } = await params
  const supabase = await createClient()

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
  const supabase = await createClient()

  // Get the channel to check chapter_id
  const { data: channel } = await supabase
    .from('channels')
    .select('id, chapter_id')
    .eq('id', channelId)
    .single()

  if (!channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
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
  const supabase = await createClient()

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
