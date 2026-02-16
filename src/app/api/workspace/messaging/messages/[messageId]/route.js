import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'

export async function PATCH(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messageId } = await params
  const supabase = createAdminClient()

  // Get the message and verify ownership
  const { data: message } = await supabase
    .from('messages')
    .select('id, sender_id, is_deleted')
    .eq('id', messageId)
    .single()

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  if (message.sender_id !== teamMember.id) {
    return NextResponse.json({ error: 'Only the sender can edit this message' }, { status: 403 })
  }

  if (message.is_deleted) {
    return NextResponse.json({ error: 'Cannot edit a deleted message' }, { status: 400 })
  }

  const body = await request.json()
  const { content } = body

  if (!content || typeof content !== 'string' || !content.trim()) {
    return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
  }

  const { data: updated, error } = await supabase
    .from('messages')
    .update({ content: content.trim(), is_edited: true })
    .eq('id', messageId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to edit message' }, { status: 500 })
  }

  return NextResponse.json(updated)
}

export async function DELETE(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messageId } = await params
  const supabase = createAdminClient()

  // Get the message and verify ownership
  const { data: message } = await supabase
    .from('messages')
    .select('id, sender_id')
    .eq('id', messageId)
    .single()

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  if (message.sender_id !== teamMember.id) {
    return NextResponse.json({ error: 'Only the sender can delete this message' }, { status: 403 })
  }

  const { error } = await supabase
    .from('messages')
    .update({ is_deleted: true })
    .eq('id', messageId)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
