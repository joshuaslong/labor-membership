import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST - Add a new team member
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check caller is a super_admin or national_admin
    const { data: caller } = await supabase
      .from('team_members')
      .select('id, roles')
      .eq('user_id', user.id)
      .single()

    if (!caller) {
      return NextResponse.json({ error: 'Not a team member' }, { status: 403 })
    }

    const isTopAdmin = caller.roles.includes('super_admin') || caller.roles.includes('national_admin')
    if (!isTopAdmin) {
      return NextResponse.json({ error: 'Only super admins and national admins can manage team members' }, { status: 403 })
    }

    const body = await request.json()
    const { user_id, chapter_id, chapter_ids, roles } = body

    if (!user_id || !roles || !Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json({ error: 'user_id and at least one role are required' }, { status: 400 })
    }

    // Only super_admin can assign super_admin role
    if (roles.includes('super_admin') && !caller.roles.includes('super_admin')) {
      return NextResponse.json({ error: 'Only super admins can assign the super admin role' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Check if user already exists as team member
    const { data: existing } = await adminClient
      .from('team_members')
      .select('id')
      .eq('user_id', user_id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'This user is already a team member' }, { status: 400 })
    }

    // Get member_id for this user
    const { data: member } = await adminClient
      .from('members')
      .select('id')
      .eq('user_id', user_id)
      .single()

    // Support both single chapter_id and multiple chapter_ids
    const allChapterIds = chapter_ids?.length > 0
      ? chapter_ids
      : chapter_id ? [chapter_id] : []

    const primaryChapterId = allChapterIds[0] || null

    const { data: teamMember, error } = await adminClient
      .from('team_members')
      .insert({
        user_id,
        member_id: member?.id || null,
        chapter_id: primaryChapterId,
        roles,
        active: true,
      })
      .select()
      .single()

    if (error) throw error

    // Insert chapter assignments into junction table
    if (allChapterIds.length > 0) {
      const chapterRows = allChapterIds.map((cId, i) => ({
        team_member_id: teamMember.id,
        chapter_id: cId,
        is_primary: i === 0,
      }))

      await adminClient
        .from('team_member_chapters')
        .insert(chapterRows)
    }

    // Auto-join all channels in the team member's chapters
    if (allChapterIds.length > 0) {
      const { data: chapterChannels } = await adminClient
        .from('channels')
        .select('id')
        .in('chapter_id', allChapterIds)
        .eq('is_archived', false)
        .eq('is_private', false)

      if (chapterChannels?.length > 0) {
        const channelRows = chapterChannels.map(ch => ({
          channel_id: ch.id,
          team_member_id: teamMember.id,
          role: 'member',
        }))

        await adminClient
          .from('channel_members')
          .insert(channelRows)
      }
    }

    return NextResponse.json({ teamMember }, { status: 201 })
  } catch (error) {
    console.error('Error creating team member:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
