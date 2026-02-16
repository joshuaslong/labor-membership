import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

async function checkJurisdiction(adminClient, userId, chapterId) {
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
  if (isTopAdmin) return true

  if (!teamMember.chapter_id) return false
  if (teamMember.chapter_id === chapterId) return true

  const { data: descendants } = await adminClient
    .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })
  const descendantIds = descendants?.map(d => d.id) || []
  return descendantIds.includes(chapterId)
}

// PUT - Rename a folder
export async function PUT(request, { params }) {
  try {
    const { id: folderId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get existing folder
    const { data: folder, error: folderError } = await adminClient
      .from('folders')
      .select('*')
      .eq('id', folderId)
      .single()

    if (folderError || !folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Check jurisdiction
    const hasAccess = await checkJurisdiction(adminClient, user.id, folder.chapter_id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { name } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Check for duplicate name at the same level
    let dupQuery = adminClient
      .from('folders')
      .select('id')
      .eq('chapter_id', folder.chapter_id)
      .eq('name', name)
      .neq('id', folderId)

    if (folder.parent_id) {
      dupQuery = dupQuery.eq('parent_id', folder.parent_id)
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

    // Rename folder
    const { data: updatedFolder, error: updateError } = await adminClient
      .from('folders')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('id', folderId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ folder: updatedFolder })

  } catch (error) {
    console.error('Rename folder error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete an empty folder
export async function DELETE(request, { params }) {
  try {
    const { id: folderId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get existing folder
    const { data: folder, error: folderError } = await adminClient
      .from('folders')
      .select('*')
      .eq('id', folderId)
      .single()

    if (folderError || !folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Check jurisdiction
    const hasAccess = await checkJurisdiction(adminClient, user.id, folder.chapter_id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check for files in this folder
    const { data: files } = await adminClient
      .from('files')
      .select('id')
      .eq('folder_id', folderId)
      .is('deleted_at', null)
      .limit(1)

    if (files && files.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete folder: it still contains files' },
        { status: 400 }
      )
    }

    // Check for subfolders
    const { data: subfolders } = await adminClient
      .from('folders')
      .select('id')
      .eq('parent_id', folderId)
      .limit(1)

    if (subfolders && subfolders.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete folder: it still contains subfolders' },
        { status: 400 }
      )
    }

    // Delete the folder
    const { error: deleteError } = await adminClient
      .from('folders')
      .delete()
      .eq('id', folderId)

    if (deleteError) throw deleteError

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete folder error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
