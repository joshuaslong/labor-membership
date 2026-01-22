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

    // Get all admin records for the user
    const { data: adminRecords, error } = await adminClient
      .from('admin_users')
      .select(`
        id,
        role,
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

    if (error) throw error

    if (!adminRecords || adminRecords.length === 0) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    // Find highest privilege role
    const highestRecord = adminRecords.reduce((highest, current) => {
      const currentIndex = roleHierarchy.indexOf(current.role)
      const highestIndex = roleHierarchy.indexOf(highest.role)
      return currentIndex < highestIndex ? current : highest
    }, adminRecords[0])

    // Check if user is on media team
    const isMediaTeam = adminRecords.some(a => a.is_media_team)

    return NextResponse.json({
      userId: user.id,
      email: user.email,
      highestRole: highestRecord.role,
      chapterId: highestRecord.chapter_id,
      chapter: highestRecord.chapters,
      isMediaTeam,
      allRoles: adminRecords.map(a => ({
        role: a.role,
        chapterId: a.chapter_id,
        chapterName: a.chapters?.name,
        isMediaTeam: a.is_media_team,
      })),
    })

  } catch (error) {
    console.error('Get admin info error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
