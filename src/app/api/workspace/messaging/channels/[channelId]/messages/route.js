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
      id, content, is_edited, is_deleted, created_at, updated_at, parent_message_id,
      team_members:sender_id(id,
        members(first_name, last_name)
      )
    `)
    .eq('channel_id', channelId)
    .is('parent_message_id', null) // Exclude thread replies from main feed
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

  // Fetch reactions and attachments for these messages
  const messageIds = messages.map(m => m.id)

  // Fetch thread reply counts and latest reply timestamps
  let threadInfoByMessage = {}
  if (messageIds.length > 0) {
    const { data: threadData } = await supabase
      .rpc('get_thread_info', { message_ids: messageIds })

    if (threadData) {
      for (const t of threadData) {
        threadInfoByMessage[t.parent_message_id] = {
          reply_count: t.reply_count,
          latest_reply_at: t.latest_reply_at,
        }
      }
    }
  }

  const [reactionsResult, attachmentsResult] = await Promise.all([
    messageIds.length > 0
      ? supabase
          .from('message_reactions')
          .select('message_id, emoji, team_member_id, team_members:team_member_id(id, members(first_name, last_name))')
          .in('message_id', messageIds)
      : { data: [] },
    messageIds.length > 0
      ? supabase
          .from('message_attachments')
          .select('id, message_id, original_filename, file_size_bytes, mime_type')
          .in('message_id', messageIds)
      : { data: [] },
  ])

  // Group reactions by message, then by emoji
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
    reactions: reactionsByMessage[msg.id] ? Object.values(reactionsByMessage[msg.id]) : [],
    attachments: attachmentsByMessage[msg.id] || [],
    reply_count: threadInfoByMessage[msg.id]?.reply_count || 0,
    latest_reply_at: threadInfoByMessage[msg.id]?.latest_reply_at || null,
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
  const { content, attachments, parentMessageId } = body

  // Allow empty content if there are attachments
  const hasContent = content && typeof content === 'string' && content.trim()
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0

  if (!hasContent && !hasAttachments) {
    return NextResponse.json({ error: 'Message content or attachments required' }, { status: 400 })
  }

  const messageContent = hasContent ? content.trim() : ''

  // If replying to a thread, validate parent message exists in this channel
  if (parentMessageId) {
    const { data: parentMsg } = await supabase
      .from('messages')
      .select('id')
      .eq('id', parentMessageId)
      .eq('channel_id', channelId)
      .is('parent_message_id', null) // Can only reply to top-level messages
      .single()

    if (!parentMsg) {
      return NextResponse.json({ error: 'Parent message not found in this channel' }, { status: 400 })
    }
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      channel_id: channelId,
      sender_id: teamMember.id,
      content: messageContent,
      parent_message_id: parentMessageId || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  // Save attachments if any
  let savedAttachments = []
  if (hasAttachments) {
    const attachmentRows = attachments.map(a => ({
      message_id: message.id,
      file_id: a.fileId || null,
      r2_key: a.r2Key,
      original_filename: a.filename,
      file_size_bytes: a.fileSize || null,
      mime_type: a.contentType || null,
    }))

    const { data: insertedAttachments, error: attachError } = await supabase
      .from('message_attachments')
      .insert(attachmentRows)
      .select('id, original_filename, file_size_bytes, mime_type')

    if (attachError) {
      console.error('Failed to save message attachments:', attachError)
    } else {
      savedAttachments = (insertedAttachments || []).map(a => ({
        id: a.id,
        filename: a.original_filename,
        fileSize: a.file_size_bytes,
        mimeType: a.mime_type,
      }))
    }
  }

  // Fire-and-forget push notifications
  sendMessagePushNotifications({
    channelId,
    senderTeamMemberId: teamMember.id,
    messageContent: messageContent || '(sent a file)',
    parentMessageId: parentMessageId || null,
  }).catch(err => console.error('Push notification error:', err))

  return NextResponse.json({ ...message, attachments: savedAttachments }, { status: 201 })
}
