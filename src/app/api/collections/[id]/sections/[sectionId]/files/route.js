import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function checkCollectionAccess(adminClient, userId, chapterId) {
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

  if (!chapterId) {
    return isTopAdmin
  }

  if (isTopAdmin) return true

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

async function getCollectionForSection(adminClient, collectionId, sectionId) {
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

// GET - List files in a section
export async function GET(request, { params }) {
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

    const { data: sectionFiles, error } = await adminClient
      .from('resource_section_files')
      .select(`
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
          description,
          uploaded_at,
          chapters (
            id,
            name
          )
        )
      `)
      .eq('section_id', sectionId)
      .order('sort_order', { ascending: true })

    if (error) throw error

    const files = (sectionFiles || []).map(sf => ({
      ...sf.files,
      section_file_id: sf.id,
      sort_order: sf.sort_order,
    }))

    return NextResponse.json({ files })

  } catch (error) {
    console.error('List section files error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Set/reorder files in a section (replace all entries)
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
    const { file_ids } = body

    if (!Array.isArray(file_ids)) {
      return NextResponse.json(
        { error: 'file_ids must be an array' },
        { status: 400 }
      )
    }

    // Validate all files exist and are public-accessible
    if (file_ids.length > 0) {
      const { data: files, error: filesError } = await adminClient
        .from('files')
        .select('id, access_tier')
        .in('id', file_ids)
        .is('deleted_at', null)

      if (filesError) throw filesError

      const foundIds = new Set(files.map(f => f.id))
      const missingIds = file_ids.filter(fid => !foundIds.has(fid))

      if (missingIds.length > 0) {
        return NextResponse.json(
          { error: `Files not found: ${missingIds.join(', ')}` },
          { status: 400 }
        )
      }

      // Validate all files have public access tier
      const nonPublicFiles = files.filter(f => f.access_tier !== 'public')
      if (nonPublicFiles.length > 0) {
        return NextResponse.json(
          { error: `All files in a collection must be public. ${nonPublicFiles.length} file(s) have restricted access.` },
          { status: 400 }
        )
      }
    }

    // Delete existing section files
    await adminClient
      .from('resource_section_files')
      .delete()
      .eq('section_id', sectionId)

    // Insert new entries with sort_order
    if (file_ids.length > 0) {
      const inserts = file_ids.map((fileId, index) => ({
        section_id: sectionId,
        file_id: fileId,
        sort_order: index,
      }))

      const { error: insertError } = await adminClient
        .from('resource_section_files')
        .insert(inserts)

      if (insertError) throw insertError
    }

    return NextResponse.json({ success: true, file_count: file_ids.length })

  } catch (error) {
    console.error('Set section files error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
