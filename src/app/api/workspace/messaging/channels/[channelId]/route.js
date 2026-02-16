import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { isAdmin } from '@/lib/permissions'

export async function GET(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { channelId } = await params
  const supabase = await createClient()

  const { data: channel, error } = await supabase
    .from('channels')
    .select(`
      id, name, description, chapter_id, is_archived, created_by, created_at, updated_at,
      channel_members(count)
    `)
    .eq('id', channelId)
    .single()

  if (error || !channel) {
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
  }

  return NextResponse.json({
    ...channel,
    member_count: channel.channel_members?.[0]?.count ?? 0,
    channel_members: undefined,
  })
}

export async function PATCH(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { channelId } = await params
  const supabase = await createClient()

  // Check if user is a channel admin
  const { data: membership } = await supabase
    .from('channel_members')
    .select('role')
    .eq('channel_id', channelId)
    .eq('team_member_id', teamMember.id)
    .single()

  const isChannelAdmin = membership?.role === 'admin'
  const isChapterAdmin = isAdmin(teamMember.roles)

  if (!isChannelAdmin && !isChapterAdmin) {
    return NextResponse.json({ error: 'Only channel or chapter admins can update channels' }, { status: 403 })
  }

  const body = await request.json()
  const updates = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Channel name cannot be empty' }, { status: 400 })
    }
    updates.name = body.name.trim()
  }
  if (body.description !== undefined) {
    updates.description = body.description?.trim() || null
  }
  if (body.is_archived !== undefined) {
    updates.is_archived = Boolean(body.is_archived)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: channel, error } = await supabase
    .from('channels')
    .update(updates)
    .eq('id', channelId)
    .select()
    .single()

  if (error || !channel) {
    return NextResponse.json({ error: 'Failed to update channel' }, { status: 500 })
  }

  return NextResponse.json(channel)
}
