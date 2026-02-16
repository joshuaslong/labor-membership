import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function checkCollectionAccess(adminClient, userId, chapterId) {
  // chapterId null = national collection
  const { data: adminRecords } = await adminClient
    .from('admin_users')
    .select('role, chapter_id')
    .eq('user_id', userId)

  if (!adminRecords || adminRecords.length === 0) {
    return false
  }

  const isTopAdmin = adminRecords.some(a =>
    ['super_admin', 'national_admin'].includes(a.role)
  )

  // National collections (chapter_id = null) require top admin
  if (!chapterId) {
    return isTopAdmin
  }

  if (isTopAdmin) return true

  // Check chapter jurisdiction via descendants
  for (const admin of adminRecords) {
    if (!admin.chapter_id) continue
    if (admin.chapter_id === chapterId) return true

    const { data: descendants } = await adminClient
      .rpc('get_chapter_descendants', { chapter_uuid: admin.chapter_id })
    const descendantIds = descendants?.map(d => d.id) || []
    if (descendantIds.includes(chapterId)) return true
  }

  return false
}

// GET - List collections
export async function GET(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const chapterId = searchParams.get('chapter_id') // null = national

    const adminClient = createAdminClient()

    let query = adminClient
      .from('resource_collections')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (chapterId) {
      query = query.eq('chapter_id', chapterId)
    } else {
      query = query.is('chapter_id', null)
    }

    const { data: collections, error } = await query

    if (error) throw error

    return NextResponse.json({ collections })

  } catch (error) {
    console.error('List collections error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create a collection
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const body = await request.json()
    const { name, slug, description, chapter_id, sort_order } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Missing required fields: name, slug' },
        { status: 400 }
      )
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'Slug must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      )
    }

    // Check access
    const hasAccess = await checkCollectionAccess(adminClient, user.id, chapter_id || null)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check for duplicate slug within scope
    let dupQuery = adminClient
      .from('resource_collections')
      .select('id')
      .eq('slug', slug)

    if (chapter_id) {
      dupQuery = dupQuery.eq('chapter_id', chapter_id)
    } else {
      dupQuery = dupQuery.is('chapter_id', null)
    }

    const { data: existing } = await dupQuery

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'A collection with this slug already exists' },
        { status: 409 }
      )
    }

    // Create collection
    const { data: collection, error: insertError } = await adminClient
      .from('resource_collections')
      .insert({
        name,
        slug,
        description: description || null,
        chapter_id: chapter_id || null,
        sort_order: sort_order || 0,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ collection }, { status: 201 })

  } catch (error) {
    console.error('Create collection error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
