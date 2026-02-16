import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']

// GET - Get current admin's info
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get team member record for the user
    const { data: teamMember, error } = await adminClient
      .from('team_members')
      .select(`
        id,
        roles,
        chapter_id,
        is_media_team,
        chapters (
          id,
          name,
          state_code,
          level
        )
      `)
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    if (error) throw error

    if (!teamMember) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    // Find highest privilege role
    let highestRole = null
    let bestIndex = Infinity
    for (const r of (teamMember.roles || [])) {
      const idx = roleHierarchy.indexOf(r)
      if (idx !== -1 && idx < bestIndex) {
        bestIndex = idx
        highestRole = r
      }
    }

    if (!highestRole) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      highestRole,
      chapterId: teamMember.chapter_id,
      chapter: teamMember.chapters,
      isMediaTeam: teamMember.is_media_team || false,
      allRoles: (teamMember.roles || []).map(role => ({
        role,
        chapterId: teamMember.chapter_id,
        chapterName: teamMember.chapters?.name,
        isMediaTeam: teamMember.is_media_team,
      })),
    })

  } catch (error) {
    console.error('Get admin info error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
