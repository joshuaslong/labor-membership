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

async function getCollectionForSection(adminClient, collectionId, sectionId) {
  // Verify section belongs to collection
  const { data: section, error: sectError } = await adminClient
    .from('resource_sections')
    .select('id, collection_id')
    .eq('id', sectionId)
    .eq('collection_id', collectionId)
    .single()

  if (sectError || !section) return null

  const { data: collection, error: collError } = await adminClient
    .from('resource_collections')
    .select('id, chapter_id')
    .eq('id', collectionId)
    .single()

  if (collError || !collection) return null

  return collection
}

// PUT - Update a section
export async function PUT(request, { params }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, sectionId } = await params
    const adminClient = createAdminClient()

    const collection = await getCollectionForSection(adminClient, id, sectionId)
    if (!collection) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    const hasAccess = await checkCollectionAccess(adminClient, user.id, collection.chapter_id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const updates = {}

    if (body.name !== undefined) updates.name = body.name
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order

    updates.updated_at = new Date().toISOString()

    const { data: section, error: updateError } = await adminClient
      .from('resource_sections')
      .update(updates)
      .eq('id', sectionId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ section })

  } catch (error) {
    console.error('Update section error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete a section (and its file associations)
export async function DELETE(request, { params }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, sectionId } = await params
    const adminClient = createAdminClient()

    const collection = await getCollectionForSection(adminClient, id, sectionId)
    if (!collection) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 })
    }

    const hasAccess = await checkCollectionAccess(adminClient, user.id, collection.chapter_id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete section files first
    await adminClient
      .from('resource_section_files')
      .delete()
      .eq('section_id', sectionId)

    // Delete section
    const { error: deleteError } = await adminClient
      .from('resource_sections')
      .delete()
      .eq('id', sectionId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete section error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
