import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { resolveChapterIds, applyChapterFilter } from '@/lib/chapterScope'
import { isAdmin } from '@/lib/permissions'

export async function GET(request) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Read chapter scope from query param (client passes it explicitly)
  const url = new URL(request.url)
  const chapterParam = url.searchParams.get('chapter')

  let chapterIds = null
  if (chapterParam && chapterParam !== 'all') {
    chapterIds = await resolveChapterIds(
      { chapterId: chapterParam, includeDescendants: true },
      supabase
    )
  }

  let query = supabase
    .from('channels')
    .select(`
      id, name, description, chapter_id, is_archived, is_private, created_at,
      channel_members(count)
    `)
    .eq('is_archived', false)
    .order('name')

  query = applyChapterFilter(query, chapterIds)

  const { data: channels, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
  }

  // Check which channels the current user has joined + get read cursors
  const channelIds = channels.map(c => c.id)
  let membershipMap = {}

  if (channelIds.length > 0) {
    const { data: memberships } = await supabase
      .from('channel_members')
      .select('channel_id, last_read_at')
      .eq('team_member_id', teamMember.id)
      .in('channel_id', channelIds)

    for (const m of (memberships || [])) {
      membershipMap[m.channel_id] = m.last_read_at
    }
  }

  const result = channels
    // Hide private channels the user hasn't joined
    .filter(ch => !ch.is_private || ch.id in membershipMap)
    .map(ch => ({
      id: ch.id,
      name: ch.name,
      description: ch.description,
      chapter_id: ch.chapter_id,
      is_archived: ch.is_archived,
      is_private: ch.is_private,
      created_at: ch.created_at,
      member_count: ch.channel_members?.[0]?.count ?? 0,
      is_member: ch.id in membershipMap,
      last_read_at: membershipMap[ch.id] ?? null,
    }))

  return NextResponse.json(result)
}

export async function POST(request) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin(teamMember.roles)) {
    return NextResponse.json({ error: 'Only admins can create channels' }, { status: 403 })
  }

  const body = await request.json()
  const { name, description, chapter_id: chapterId, is_private, member_ids } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Channel name is required' }, { status: 400 })
  }

  if (!chapterId) {
    return NextResponse.json({ error: 'Select a chapter to create a channel' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Create channel
  const { data: channel, error } = await supabase
    .from('channels')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      chapter_id: chapterId,
      created_by: teamMember.id,
      is_private: !!is_private,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A channel with this name already exists in this chapter' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 })
  }

  if (is_private) {
    // Private channel: add creator as admin + any specified members
    const rows = [
      { channel_id: channel.id, team_member_id: teamMember.id, role: 'admin' },
    ]
    if (Array.isArray(member_ids)) {
      for (const tmId of member_ids) {
        if (tmId !== teamMember.id) {
          rows.push({ channel_id: channel.id, team_member_id: tmId, role: 'member' })
        }
      }
    }
    await supabase.from('channel_members').insert(rows)
  } else {
    // Public channel: auto-add all team members in this chapter
    const { data: chapterTeamMembers } = await supabase
      .from('team_member_chapters')
      .select('team_member_id')
      .eq('chapter_id', chapterId)

    const { data: primaryChapterMembers } = await supabase
      .from('team_members')
      .select('id')
      .eq('chapter_id', chapterId)
      .eq('active', true)

    const allMemberIds = new Set()
    for (const m of (chapterTeamMembers || [])) allMemberIds.add(m.team_member_id)
    for (const m of (primaryChapterMembers || [])) allMemberIds.add(m.id)

    if (allMemberIds.size > 0) {
      const rows = [...allMemberIds].map(tmId => ({
        channel_id: channel.id,
        team_member_id: tmId,
        role: tmId === teamMember.id ? 'admin' : 'member',
      }))

      await supabase.from('channel_members').insert(rows)
    }
  }

  return NextResponse.json(channel, { status: 201 })
}
