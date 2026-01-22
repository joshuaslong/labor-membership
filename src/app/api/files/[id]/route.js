import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { deleteFile } from '@/lib/r2'

const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']

function getHighestPrivilegeAdmin(adminRecords) {
  if (!adminRecords || adminRecords.length === 0) return null
  return adminRecords.reduce((highest, current) => {
    const currentIndex = roleHierarchy.indexOf(current.role)
    const highestIndex = roleHierarchy.indexOf(highest.role)
    return currentIndex < highestIndex ? current : highest
  }, adminRecords[0])
}

// GET - Get single file details
export async function GET(request, { params }) {
  try {
    const { id: fileId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const adminClient = createAdminClient()

    const { data: file, error: fileError } = await adminClient
      .from('files')
      .select(`
        *,
        chapters (id, name, state_code, level)
      `)
      .eq('id', fileId)
      .is('deleted_at', null)
      .single()

    if (fileError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check access using RPC
    const { data: canAccess } = await adminClient.rpc('can_access_file', {
      file_uuid: fileId,
      user_uuid: user?.id || null
    })

    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get uploader name
    let uploaderName = 'Unknown'
    if (file.uploaded_by) {
      const { data: uploader } = await adminClient
        .from('members')
        .select('first_name, last_name')
        .eq('user_id', file.uploaded_by)
        .single()

      if (uploader) {
        uploaderName = `${uploader.first_name} ${uploader.last_name}`
      }
    }

    return NextResponse.json({
      file: {
        ...file,
        uploader_name: uploaderName,
      }
    })

  } catch (error) {
    console.error('Get file error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update file metadata
export async function PUT(request, { params }) {
  try {
    const { id: fileId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get file
    const { data: file } = await adminClient
      .from('files')
      .select('*')
      .eq('id', fileId)
      .is('deleted_at', null)
      .single()

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check permission - uploader or super/national admin
    const { data: adminRecords } = await adminClient
      .from('admin_users')
      .select('id, role, chapter_id')
      .eq('user_id', user.id)

    const currentAdmin = getHighestPrivilegeAdmin(adminRecords)
    const canUpdate = file.uploaded_by === user.id ||
      (currentAdmin && ['super_admin', 'national_admin'].includes(currentAdmin.role))

    if (!canUpdate) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    const body = await request.json()
    const { description, tags } = body

    const updateData = {}
    if (description !== undefined) updateData.description = description
    if (tags !== undefined) updateData.tags = tags

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }

    const { data: updatedFile, error } = await adminClient
      .from('files')
      .update(updateData)
      .eq('id', fileId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ file: updatedFile })

  } catch (error) {
    console.error('Update file error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Soft delete a file (or hard delete for super_admin)
export async function DELETE(request, { params }) {
  try {
    const { id: fileId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get file
    const { data: file } = await adminClient
      .from('files')
      .select('*')
      .eq('id', fileId)
      .is('deleted_at', null)
      .single()

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check delete permission
    const { data: adminRecords } = await adminClient
      .from('admin_users')
      .select('id, role, chapter_id, is_media_team')
      .eq('user_id', user.id)

    const currentAdmin = getHighestPrivilegeAdmin(adminRecords)
    const isMediaTeam = adminRecords?.some(a => a.is_media_team) || false

    let canDelete = false

    // Super/national admin can delete anything
    if (currentAdmin?.role === 'super_admin' || currentAdmin?.role === 'national_admin') {
      canDelete = true
    }
    // User can delete their own uploads
    else if (file.uploaded_by === user.id) {
      canDelete = true
    }
    // Chapter admin can delete files in their jurisdiction
    else if (currentAdmin && file.chapter_id && file.access_tier === 'chapter') {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })
      const allowedIds = (descendants?.map(d => d.id) || [])
      if (currentAdmin.chapter_id) {
        allowedIds.push(currentAdmin.chapter_id)
      }
      canDelete = allowedIds.includes(file.chapter_id)
    }
    // Media team can delete media files
    else if (file.access_tier === 'media' && isMediaTeam) {
      canDelete = true
    }

    if (!canDelete) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Check query param for hard delete (super_admin only)
    const { searchParams } = new URL(request.url)
    const hardDelete = searchParams.get('hard') === 'true'

    if (hardDelete && currentAdmin?.role === 'super_admin') {
      // Delete from R2
      try {
        await deleteFile(file.r2_key)
      } catch (r2Error) {
        console.error('R2 delete error:', r2Error)
        // Continue with database delete even if R2 fails
      }

      // Hard delete from database
      await adminClient
        .from('files')
        .delete()
        .eq('id', fileId)
    } else {
      // Soft delete
      await adminClient
        .from('files')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: user.id,
        })
        .eq('id', fileId)
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
