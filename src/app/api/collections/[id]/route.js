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

  // National collections (chapter_id = null) require top admin
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

// GET - Get single collection with sections and files
export async function GET(request, { params }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const adminClient = createAdminClient()

    // Fetch collection
    const { data: collection, error: collError } = await adminClient
      .from('resource_collections')
      .select('*')
      .eq('id', id)
      .single()

    if (collError || !collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    // Fetch sections with their files
    const { data: sections, error: sectError } = await adminClient
      .from('resource_sections')
      .select(`
        id,
        name,
        sort_order,
        created_at,
        updated_at,
        resource_section_files (
          id,
          file_id,
          sort_order,
          files (
            id,
            original_filename,
            mime_type,
            file_size_bytes,
            access_tier,
            bucket_prefix,
            uploaded_at
          )
        )
      `)
      .eq('collection_id', id)
      .order('sort_order', { ascending: true })

    if (sectError) throw sectError

    // Clean up section files - sort by sort_order and flatten
    const enrichedSections = (sections || []).map(section => ({
      ...section,
      files: (section.resource_section_files || [])
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map(sf => ({
          ...sf.files,
          section_file_id: sf.id,
          sort_order: sf.sort_order,
        })),
      resource_section_files: undefined,
    }))

    return NextResponse.json({
      collection,
      sections: enrichedSections,
    })

  } catch (error) {
    console.error('Get collection error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update a collection
export async function PUT(request, { params }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const adminClient = createAdminClient()

    // Fetch existing collection
    const { data: existing, error: fetchError } = await adminClient
      .from('resource_collections')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    // Check access based on existing collection's chapter
    const hasAccess = await checkCollectionAccess(adminClient, user.id, existing.chapter_id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const updates = {}

    if (body.name !== undefined) updates.name = body.name
    if (body.slug !== undefined) {
      // Validate slug format
      if (!/^[a-z0-9-]+$/.test(body.slug)) {
        return NextResponse.json(
          { error: 'Slug must contain only lowercase letters, numbers, and hyphens' },
          { status: 400 }
        )
      }

      // Check for duplicate slug (excluding self)
      let dupQuery = adminClient
        .from('resource_collections')
        .select('id')
        .eq('slug', body.slug)
        .neq('id', id)

      if (existing.chapter_id) {
        dupQuery = dupQuery.eq('chapter_id', existing.chapter_id)
      } else {
        dupQuery = dupQuery.is('chapter_id', null)
      }

      const { data: dupes } = await dupQuery
      if (dupes && dupes.length > 0) {
        return NextResponse.json(
          { error: 'A collection with this slug already exists' },
          { status: 409 }
        )
      }

      updates.slug = body.slug
    }
    if (body.description !== undefined) updates.description = body.description
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order
    if (body.is_published !== undefined) updates.is_published = body.is_published

    updates.updated_at = new Date().toISOString()

    const { data: collection, error: updateError } = await adminClient
      .from('resource_collections')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ collection })

  } catch (error) {
    console.error('Update collection error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete a collection (cascades to sections and section_files)
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const adminClient = createAdminClient()

    // Fetch existing collection
    const { data: existing, error: fetchError } = await adminClient
      .from('resource_collections')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    // Check access
    const hasAccess = await checkCollectionAccess(adminClient, user.id, existing.chapter_id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get sections to cascade delete section_files
    const { data: sections } = await adminClient
      .from('resource_sections')
      .select('id')
      .eq('collection_id', id)

    if (sections && sections.length > 0) {
      const sectionIds = sections.map(s => s.id)

      // Delete section files
      await adminClient
        .from('resource_section_files')
        .delete()
        .in('section_id', sectionIds)

      // Delete sections
      await adminClient
        .from('resource_sections')
        .delete()
        .eq('collection_id', id)
    }

    // Delete collection
    const { error: deleteError } = await adminClient
      .from('resource_collections')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete collection error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
