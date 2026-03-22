import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'

export async function GET(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messageId } = await params
  const supabase = createAdminClient()

  // Get the parent message to find the channel
  const { data: parentMsg } = await supabase
    .from('messages')
    .select('id, channel_id, content, is_edited, is_deleted, created_at, updated_at, team_members:sender_id(id, members(first_name, last_name))')
    .eq('id', messageId)
    .is('parent_message_id', null)
    .single()

  if (!parentMsg) {
    return NextResponse.json({ error: 'Parent message not found' }, { status: 404 })
  }

  // Verify user is a channel member
  const { data: membership } = await supabase
    .from('channel_members')
    .select('id')
    .eq('channel_id', parentMsg.channel_id)
    .eq('team_member_id', teamMember.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

  // Fetch thread replies (oldest first for chronological display)
  let query = supabase
    .from('messages')
    .select(`
      id, content, is_edited, is_deleted, created_at, updated_at,
      team_members:sender_id(id, members(first_name, last_name))
    `)
    .eq('parent_message_id', messageId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (cursor) {
    const { data: cursorMsg } = await supabase
      .from('messages')
      .select('created_at')
      .eq('id', cursor)
      .single()

    if (cursorMsg) {
      query = query.gt('created_at', cursorMsg.created_at)
    }
  }

  const { data: replies, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch thread' }, { status: 500 })
  }

  // Fetch reactions and attachments for parent + replies
  const allMessageIds = [parentMsg.id, ...replies.map(r => r.id)]

  const [reactionsResult, attachmentsResult] = await Promise.all([
    supabase
      .from('message_reactions')
      .select('message_id, emoji, team_member_id, team_members:team_member_id(id, members(first_name, last_name))')
      .in('message_id', allMessageIds),
    supabase
      .from('message_attachments')
      .select('id, message_id, original_filename, file_size_bytes, mime_type')
      .in('message_id', allMessageIds),
  ])

  // Group reactions by message then emoji
  const reactionsByMessage = {}
  for (const r of (reactionsResult.data || [])) {
    if (!reactionsByMessage[r.message_id]) reactionsByMessage[r.message_id] = {}
    const group = reactionsByMessage[r.message_id]
    if (!group[r.emoji]) {
      group[r.emoji] = { emoji: r.emoji, count: 0, users: [], reacted: false }
    }
    group[r.emoji].count++
    const name = [r.team_members?.members?.first_name, r.team_members?.members?.last_name].filter(Boolean).join(' ')
    group[r.emoji].users.push({ id: r.team_members?.id, name })
    if (r.team_members?.id === teamMember.id) {
      group[r.emoji].reacted = true
    }
  }

  // Group attachments by message
  const attachmentsByMessage = {}
  for (const a of (attachmentsResult.data || [])) {
    if (!attachmentsByMessage[a.message_id]) attachmentsByMessage[a.message_id] = []
    attachmentsByMessage[a.message_id].push({
      id: a.id,
      filename: a.original_filename,
      fileSize: a.file_size_bytes,
      mimeType: a.mime_type,
    })
  }

  const formatMessage = (msg) => ({
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
    reactions: reactionsByMessage[msg.id] ? Object.values(reactionsByMessage[msg.id]) : [],
    attachments: attachmentsByMessage[msg.id] || [],
  })

  return NextResponse.json({
    parent: formatMessage(parentMsg),
    replies: replies.map(formatMessage),
    has_more: replies.length === limit,
  })
}
