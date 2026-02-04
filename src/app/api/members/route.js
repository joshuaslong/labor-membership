import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request) {
  // Authenticate user
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Get current admin's role and chapter
  const { data: currentAdmin } = await supabase
    .from('admin_users')
    .select('id, role, chapter_id')
    .eq('user_id', user.id)
    .single()

  if (!currentAdmin) {
    return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const chapter_id = searchParams.get('chapter_id')
  const status = searchParams.get('status')

  // Get chapter IDs this admin can access
  // super_admin and national_admin have access to all data
  let allowedChapterIds = null
  if (!['super_admin', 'national_admin'].includes(currentAdmin.role)) {
    const { data: descendants } = await supabase
      .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })
    allowedChapterIds = descendants?.map(d => d.id) || []
  }

  // If a specific chapter is requested, use member_chapters junction table
  // to get ALL members who belong to that chapter (including via hierarchy)
  if (chapter_id) {
    if (allowedChapterIds && !allowedChapterIds.includes(chapter_id)) {
      return NextResponse.json({ error: 'Access denied to this chapter' }, { status: 403 })
    }

    // Query via member_chapters to get members in this chapter (direct or via hierarchy)
    let junctionQuery = supabase
      .from('member_chapters')
      .select('member_id, members!inner(*,chapters(name, level))')
      .eq('chapter_id', chapter_id)

    const { data: memberChapters, error: junctionError } = await junctionQuery

    if (junctionError) {
      return NextResponse.json({ error: junctionError.message }, { status: 500 })
    }

    // Extract members and filter by status if needed
    let members = (memberChapters || []).map(mc => mc.members).filter(m => m !== null)
    if (status) {
      members = members.filter(m => m.status === status)
    }

    // Sort by last name
    members.sort((a, b) => (a.last_name || '').localeCompare(b.last_name || ''))

    return NextResponse.json({ members })
  }

  // No specific chapter requested - use original query on members table
  let query = supabase
    .from('members')
    .select('*, chapters(name, level)')
    .order('last_name')

  if (allowedChapterIds) {
    query = query.in('chapter_id', allowedChapterIds)
  }

  if (status) query = query.eq('status', status)

  const { data: members, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ members })
}

export async function POST(request) {
  const data = await request.json()
  const supabase = createAdminClient()

  // Validate required fields
  if (!data.first_name || !data.last_name || !data.email || !data.chapter_id) {
    return NextResponse.json(
      { error: 'First name, last name, email, and chapter are required' },
      { status: 400 }
    )
  }

  // Check if email exists
  const { data: existing } = await supabase
    .from('members')
    .select('id')
    .eq('email', data.email)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'A member with this email already exists' },
      { status: 409 }
    )
  }

  // Create member record - active immediately
  const { data: member, error: memberError } = await supabase
    .from('members')
    .insert({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone || null,
      address_line1: data.address_line1 || null,
      city: data.city || null,
      state: data.state || null,
      zip_code: data.zip_code || null,
      chapter_id: data.chapter_id,
      status: 'active',
    })
    .select()
    .single()

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ member }, { status: 201 })
}
