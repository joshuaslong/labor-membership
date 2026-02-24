import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { sendMessagePushNotifications } from '@/lib/web-push'

export async function GET(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { channelId } = await params
  const supabase = createAdminClient()

  // Verify user is a channel member
  const { data: membership } = await supabase
    .from('channel_members')
    .select('id')
    .eq('channel_id', channelId)
    .eq('team_member_id', teamMember.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

  let query = supabase
    .from('messages')
    .select(`
      id, content, is_edited, is_deleted, created_at, updated_at,
      team_members:sender_id(id,
        members(first_name, last_name)
      )
    `)
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) {
    // Cursor-based pagination: get messages older than the cursor message
    const { data: cursorMsg } = await supabase
      .from('messages')
      .select('created_at')
      .eq('id', cursor)
      .single()

    if (cursorMsg) {
      query = query.lt('created_at', cursorMsg.created_at)
    }
  }

  const { data: messages, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
  }

  const result = messages.map(msg => ({
    id: msg.id,
    content: msg.is_deleted ? null : msg.content,
    is_edited: msg.is_edited,
    is_deleted: msg.is_deleted,
    created_at: msg.created_at,
    updated_at: msg.updated_at,
    sender: {
      team_member_id: msg.team_members?.id ?? null,
      first_name: msg.team_members?.members?.first_name ?? null,
      last_name: msg.team_members?.members?.last_name ?? null,
    },
  }))

  return NextResponse.json({
    messages: result,
    has_more: result.length === limit,
  })
}

export async function POST(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { channelId } = await params
  const supabase = createAdminClient()

  // Verify user is a channel member
  const { data: membership } = await supabase
    .from('channel_members')
    .select('id')
    .eq('channel_id', channelId)
    .eq('team_member_id', teamMember.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 })
  }

  const body = await request.json()
  const { content } = body

  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      channel_id: channelId,
      sender_id: teamMember.id,
      content: content.trim(),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  // Fire-and-forget push notifications to subscribed channel members
  sendMessagePushNotifications({
    channelId,
    senderTeamMemberId: teamMember.id,
    messageContent: content.trim(),
  }).catch(err => console.error('Push notification error:', err))

  return NextResponse.json(message, { status: 201 })
}
