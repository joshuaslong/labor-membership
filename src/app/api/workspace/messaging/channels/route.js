import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { getEffectiveChapterScope, resolveChapterIds, applyChapterFilter } from '@/lib/chapterScope'
import { isAdmin } from '@/lib/permissions'

export async function GET() {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const scope = await getEffectiveChapterScope(teamMember)
  const chapterIds = await resolveChapterIds(scope, supabase)

  let query = supabase
    .from('channels')
    .select(`
      id, name, description, chapter_id, is_archived, created_at,
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

  const result = channels.map(ch => ({
    id: ch.id,
    name: ch.name,
    description: ch.description,
    chapter_id: ch.chapter_id,
    is_archived: ch.is_archived,
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
  const { name, description } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Channel name is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const scope = await getEffectiveChapterScope(teamMember)

  if (!scope || !scope.chapterId) {
    return NextResponse.json({ error: 'Select a chapter to create a channel' }, { status: 400 })
  }

  const chapterId = scope.chapterId

  // Create channel
  const { data: channel, error } = await supabase
    .from('channels')
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      chapter_id: chapterId,
      created_by: teamMember.id,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 })
  }

  // Add creator as admin member
  await supabase
    .from('channel_members')
    .insert({
      channel_id: channel.id,
      team_member_id: teamMember.id,
      role: 'admin',
    })

  return NextResponse.json(channel, { status: 201 })
}
