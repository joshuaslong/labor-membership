import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { hasRole } from '@/lib/permissions'

export async function POST(request) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { chapterId } = await request.json()

  const cookieOptions = {
    path: '/workspace',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  }

  // "all" — only valid for users with full access
  if (chapterId === 'all') {
    if (!hasRole(teamMember.roles, ['super_admin', 'national_admin'])) {
      return NextResponse.json({ error: 'Not authorized for all chapters' }, { status: 403 })
    }
    const response = NextResponse.json({ ok: true })
    response.cookies.set('chapter_scope', 'all', cookieOptions)
    return response
  }

  // Validate the chapter exists
  const supabase = await createClient()
  const { data: chapter } = await supabase
    .from('chapters')
    .select('id, name, level')
    .eq('id', chapterId)
    .single()

  if (!chapter) {
    return NextResponse.json({ error: 'Chapter not found' }, { status: 404 })
  }

  // Super/national admins can access any chapter
  if (hasRole(teamMember.roles, ['super_admin', 'national_admin'])) {
    const response = NextResponse.json({ ok: true, chapter })
    response.cookies.set('chapter_scope', chapterId, cookieOptions)
    return response
  }

  // Geographic admins: must be their chapter or a descendant
  if (hasRole(teamMember.roles, ['state_admin', 'county_admin', 'city_admin'])) {
    if (chapterId === teamMember.chapter_id) {
      const response = NextResponse.json({ ok: true, chapter })
      response.cookies.set('chapter_scope', chapterId, cookieOptions)
      return response
    }

    const { data: descendants } = await supabase
      .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })
    const allowedIds = descendants?.map(d => d.id) || []

    if (!allowedIds.includes(chapterId)) {
      return NextResponse.json({ error: 'Not authorized for this chapter' }, { status: 403 })
    }

    const response = NextResponse.json({ ok: true, chapter })
    response.cookies.set('chapter_scope', chapterId, cookieOptions)
    return response
  }

  // Non-admin roles: only their own chapter
  if (chapterId !== teamMember.chapter_id) {
    return NextResponse.json({ error: 'Not authorized for this chapter' }, { status: 403 })
  }

  const response = NextResponse.json({ ok: true, chapter })
  response.cookies.set('chapter_scope', chapterId, cookieOptions)
  return response
}
