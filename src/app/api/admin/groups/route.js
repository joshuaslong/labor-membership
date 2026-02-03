import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - List groups for a chapter
export async function GET(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const { data: adminRecords } = await adminClient
      .from('admin_users')
      .select('id, role, chapter_id')
      .eq('user_id', user.id)

    if (!adminRecords || adminRecords.length === 0) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const chapterId = searchParams.get('chapterId')

    if (!chapterId) {
      return NextResponse.json({ error: 'chapterId is required' }, { status: 400 })
    }

    // Verify jurisdiction
    const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
    const currentAdmin = adminRecords.reduce((highest, current) => {
      const currentIndex = roleHierarchy.indexOf(current.role)
      const highestIndex = roleHierarchy.indexOf(highest.role)
      return currentIndex < highestIndex ? current : highest
    }, adminRecords[0])

    const isSuperAdmin = ['super_admin', 'national_admin'].includes(currentAdmin.role)

    if (!isSuperAdmin) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })
      const allowedChapterIds = descendants?.map(d => d.id) || []

      if (!allowedChapterIds.includes(chapterId) && currentAdmin.chapter_id !== chapterId) {
        return NextResponse.json({ error: 'You do not have access to this chapter' }, { status: 403 })
      }
    }

    // Fetch groups with member counts
    const { data: groups, error } = await adminClient
      .from('chapter_groups')
      .select('*, member_group_assignments(count)')
      .eq('chapter_id', chapterId)
      .order('name')

    if (error) throw error

    const formatted = (groups || []).map(g => ({
      ...g,
      member_count: g.member_group_assignments?.[0]?.count || 0,
      member_group_assignments: undefined,
    }))

    return NextResponse.json({ groups: formatted })

  } catch (error) {
    console.error('Error fetching groups:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create a new group
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const { data: adminRecords } = await adminClient
      .from('admin_users')
      .select('id, role, chapter_id')
      .eq('user_id', user.id)

    if (!adminRecords || adminRecords.length === 0) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    const body = await request.json()
    const { chapterId, name, description } = body

    if (!chapterId || !name) {
      return NextResponse.json({ error: 'chapterId and name are required' }, { status: 400 })
    }

    // Verify jurisdiction
    const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
    const currentAdmin = adminRecords.reduce((highest, current) => {
      const currentIndex = roleHierarchy.indexOf(current.role)
      const highestIndex = roleHierarchy.indexOf(highest.role)
      return currentIndex < highestIndex ? current : highest
    }, adminRecords[0])

    const isSuperAdmin = ['super_admin', 'national_admin'].includes(currentAdmin.role)

    if (!isSuperAdmin) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })
      const allowedChapterIds = descendants?.map(d => d.id) || []

      if (!allowedChapterIds.includes(chapterId) && currentAdmin.chapter_id !== chapterId) {
        return NextResponse.json({ error: 'You do not have access to this chapter' }, { status: 403 })
      }
    }

    const { data: group, error } = await adminClient
      .from('chapter_groups')
      .insert({
        chapter_id: chapterId,
        name: name.trim(),
        description: description?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A group with this name already exists in this chapter' }, { status: 400 })
      }
      throw error
    }

    return NextResponse.json({ group }, { status: 201 })

  } catch (error) {
    console.error('Error creating group:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
