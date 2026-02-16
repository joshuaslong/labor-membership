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

// PUT - Move a file to a different folder
export async function PUT(request, { params }) {
  try {
    const { id: fileId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get the file
    const { data: file, error: fileError } = await adminClient
      .from('files')
      .select('*')
      .eq('id', fileId)
      .is('deleted_at', null)
      .single()

    if (fileError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check jurisdiction on the file's chapter
    if (file.chapter_id) {
      const hasAccess = await checkJurisdiction(adminClient, user.id, file.chapter_id)
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    } else {
      // File has no chapter - only top admins can move it
      const { data: moveTeamMember } = await adminClient
        .from('team_members')
        .select('roles')
        .eq('user_id', user.id)
        .eq('active', true)
        .single()

      const isTopAdmin = moveTeamMember?.roles?.some(r =>
        ['super_admin', 'national_admin'].includes(r)
      )
      if (!isTopAdmin && file.uploaded_by !== user.id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    const body = await request.json()
    const { folder_id } = body // null = move to root

    if (folder_id) {
      // Verify target folder exists and is in the same chapter
      const { data: targetFolder, error: folderError } = await adminClient
        .from('folders')
        .select('id, chapter_id')
        .eq('id', folder_id)
        .single()

      if (folderError || !targetFolder) {
        return NextResponse.json({ error: 'Target folder not found' }, { status: 404 })
      }

      if (file.chapter_id && targetFolder.chapter_id !== file.chapter_id) {
        return NextResponse.json(
          { error: 'Target folder must be in the same chapter as the file' },
          { status: 400 }
        )
      }
    }

    // Move the file
    const { data: updatedFile, error: updateError } = await adminClient
      .from('files')
      .update({ folder_id: folder_id || null })
      .eq('id', fileId)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({ file: updatedFile })

  } catch (error) {
    console.error('Move file error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
