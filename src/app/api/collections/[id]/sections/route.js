import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function checkCollectionAccess(adminClient, userId, chapterId) {
  const { data: teamMember } = await adminClient
    .from('team_members')
    .select('roles, chapter_id')
    .eq('user_id', userId)
    .eq('active', true)
    .single()

  if (!teamMember || !teamMember.roles?.length) {
    return false
  }

  const isTopAdmin = teamMember.roles.some(r =>
    ['super_admin', 'national_admin'].includes(r)
  )

  if (!chapterId) {
    return isTopAdmin
  }

  if (isTopAdmin) return true

  if (!teamMember.chapter_id) return false
  if (teamMember.chapter_id === chapterId) return true

  const { data: descendants } = await adminClient
    .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })
  const descendantIds = descendants?.map(d => d.id) || []
  return descendantIds.includes(chapterId)
}

// GET - List sections for a collection (with file counts)
export async function GET(request, { params }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const adminClient = createAdminClient()

    // Verify collection exists
    const { data: collection, error: collError } = await adminClient
      .from('resource_collections')
      .select('id, chapter_id')
      .eq('id', id)
      .single()

    if (collError || !collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    // Fetch sections
    const { data: sections, error: sectError } = await adminClient
      .from('resource_sections')
      .select(`
        id,
        name,
        sort_order,
        created_at,
        updated_at,
        resource_section_files (id)
      `)
      .eq('collection_id', id)
      .order('sort_order', { ascending: true })

    if (sectError) throw sectError

    const enrichedSections = (sections || []).map(section => ({
      id: section.id,
      name: section.name,
      sort_order: section.sort_order,
      created_at: section.created_at,
      updated_at: section.updated_at,
      file_count: section.resource_section_files?.length || 0,
    }))

    return NextResponse.json({ sections: enrichedSections })

  } catch (error) {
    console.error('List sections error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create a new section in a collection
export async function POST(request, { params }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const adminClient = createAdminClient()

    // Verify collection exists and check access
    const { data: collection, error: collError } = await adminClient
      .from('resource_collections')
      .select('id, chapter_id')
      .eq('id', id)
      .single()

    if (collError || !collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    const hasAccess = await checkCollectionAccess(adminClient, user.id, collection.chapter_id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { name, sort_order } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      )
    }

    // Auto-calculate sort_order if not provided
    let effectiveSortOrder = sort_order
    if (effectiveSortOrder === undefined || effectiveSortOrder === null) {
      const { data: maxSection } = await adminClient
        .from('resource_sections')
        .select('sort_order')
        .eq('collection_id', id)
        .order('sort_order', { ascending: false })
        .limit(1)

      effectiveSortOrder = maxSection && maxSection.length > 0
        ? (maxSection[0].sort_order || 0) + 1
        : 0
    }

    const { data: section, error: insertError } = await adminClient
      .from('resource_sections')
      .insert({
        collection_id: id,
        name,
        sort_order: effectiveSortOrder,
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ section }, { status: 201 })

  } catch (error) {
    console.error('Create section error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
