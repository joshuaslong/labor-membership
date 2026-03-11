import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'

// GET - List reactions for a message
export async function GET(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messageId } = await params
  const supabase = createAdminClient()

  const { data: reactions, error } = await supabase
    .from('message_reactions')
    .select(`
      id, emoji, created_at,
      team_members:team_member_id(id,
        members(first_name, last_name)
      )
    `)
    .eq('message_id', messageId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch reactions' }, { status: 500 })
  }

  // Group reactions by emoji
  const grouped = {}
  for (const r of reactions) {
    if (!grouped[r.emoji]) {
      grouped[r.emoji] = { emoji: r.emoji, count: 0, users: [], reacted: false }
    }
    grouped[r.emoji].count++
    const name = [r.team_members?.members?.first_name, r.team_members?.members?.last_name].filter(Boolean).join(' ')
    grouped[r.emoji].users.push({ id: r.team_members?.id, name })
    if (r.team_members?.id === teamMember.id) {
      grouped[r.emoji].reacted = true
    }
  }

  return NextResponse.json({ reactions: Object.values(grouped) })
}

// POST - Add or toggle a reaction
export async function POST(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messageId } = await params
  const supabase = createAdminClient()
  const { emoji } = await request.json()

  if (!emoji || typeof emoji !== 'string') {
    return NextResponse.json({ error: 'Emoji is required' }, { status: 400 })
  }

  // Verify user is a member of the channel this message belongs to
  const { data: message } = await supabase
    .from('messages')
    .select('channel_id')
    .eq('id', messageId)
    .single()

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 })
  }

  const { data: membership } = await supabase
    .from('channel_members')
    .select('id')
    .eq('channel_id', message.channel_id)
    .eq('team_member_id', teamMember.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 })
  }

  // Check if reaction already exists - toggle it
  const { data: existing } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('team_member_id', teamMember.id)
    .eq('emoji', emoji)
    .single()

  if (existing) {
    // Remove the reaction
    await supabase
      .from('message_reactions')
      .delete()
      .eq('id', existing.id)

    return NextResponse.json({ action: 'removed' })
  }

  // Add the reaction
  const { error } = await supabase
    .from('message_reactions')
    .insert({
      message_id: messageId,
      team_member_id: teamMember.id,
      emoji,
    })

  if (error) {
    return NextResponse.json({ error: 'Failed to add reaction' }, { status: 500 })
  }

  return NextResponse.json({ action: 'added' }, { status: 201 })
}
