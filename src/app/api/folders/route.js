import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function checkJurisdiction(adminClient, userId, chapterId) {
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

// GET - List folders for a chapter
export async function GET(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const chapterId = searchParams.get('chapter_id')
    const parentId = searchParams.get('parent_id') // null or absent = root

    if (!chapterId) {
      return NextResponse.json({ error: 'chapter_id is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Check jurisdiction
    const hasAccess = await checkJurisdiction(adminClient, user.id, chapterId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Query folders
    let query = adminClient
      .from('folders')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('name', { ascending: true })

    if (parentId) {
      query = query.eq('parent_id', parentId)
    } else {
      query = query.is('parent_id', null)
    }

    const { data: folders, error } = await query

    if (error) throw error

    // Get file_count and subfolder_count for each folder
    const folderIds = folders.map(f => f.id)

    let fileCounts = {}
    let subfolderCounts = {}

    if (folderIds.length > 0) {
      // Count files per folder
      const { data: fileCountData } = await adminClient
        .from('files')
        .select('folder_id', { count: 'exact', head: false })
        .in('folder_id', folderIds)
        .is('deleted_at', null)

      if (fileCountData) {
        fileCounts = fileCountData.reduce((acc, row) => {
          acc[row.folder_id] = (acc[row.folder_id] || 0) + 1
          return acc
        }, {})
      }

      // Count subfolders per folder
      const { data: subfolderCountData } = await adminClient
        .from('folders')
        .select('parent_id')
        .in('parent_id', folderIds)

      if (subfolderCountData) {
        subfolderCounts = subfolderCountData.reduce((acc, row) => {
          acc[row.parent_id] = (acc[row.parent_id] || 0) + 1
          return acc
        }, {})
      }
    }

    const enrichedFolders = folders.map(f => ({
      ...f,
      file_count: fileCounts[f.id] || 0,
      subfolder_count: subfolderCounts[f.id] || 0,
    }))

    return NextResponse.json({ folders: enrichedFolders })

  } catch (error) {
    console.error('List folders error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create a new folder
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const body = await request.json()
    const { name, chapter_id, parent_id } = body

    if (!name || !chapter_id) {
      return NextResponse.json(
        { error: 'Missing required fields: name, chapter_id' },
        { status: 400 }
      )
    }

    // Check jurisdiction
    const hasAccess = await checkJurisdiction(adminClient, user.id, chapter_id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Calculate depth from parent
    let depth = 0
    if (parent_id) {
      const { data: parentFolder, error: parentError } = await adminClient
        .from('folders')
        .select('id, depth, chapter_id')
        .eq('id', parent_id)
        .single()

      if (parentError || !parentFolder) {
        return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 })
      }

      if (parentFolder.chapter_id !== chapter_id) {
        return NextResponse.json(
          { error: 'Parent folder must be in the same chapter' },
          { status: 400 }
        )
      }

      depth = parentFolder.depth + 1
    }

    // Enforce max depth of 2
    if (depth > 2) {
      return NextResponse.json(
        { error: 'Maximum folder nesting depth (3 levels) exceeded' },
        { status: 400 }
      )
    }

    // Check for duplicate name at the same level
    let dupQuery = adminClient
      .from('folders')
      .select('id')
      .eq('chapter_id', chapter_id)
      .eq('name', name)

    if (parent_id) {
      dupQuery = dupQuery.eq('parent_id', parent_id)
    } else {
      dupQuery = dupQuery.is('parent_id', null)
    }

    const { data: existing } = await dupQuery

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'A folder with this name already exists in the same location' },
        { status: 409 }
      )
    }

    // Create folder
    const { data: folder, error: insertError } = await adminClient
      .from('folders')
      .insert({
        name,
        chapter_id,
        parent_id: parent_id || null,
        depth,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({ folder }, { status: 201 })

  } catch (error) {
    console.error('Create folder error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
