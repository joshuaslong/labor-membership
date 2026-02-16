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

// Recursively get max depth of descendants
async function getMaxDescendantDepth(adminClient, folderId) {
  const { data: children } = await adminClient
    .from('folders')
    .select('id, depth')
    .eq('parent_id', folderId)

  if (!children || children.length === 0) return 0

  let maxChildDepth = 0
  for (const child of children) {
    const childSubDepth = await getMaxDescendantDepth(adminClient, child.id)
    maxChildDepth = Math.max(maxChildDepth, 1 + childSubDepth)
  }

  return maxChildDepth
}

// Recursively update depths of all descendants
async function updateDescendantDepths(adminClient, parentId, parentDepth) {
  const { data: children } = await adminClient
    .from('folders')
    .select('id')
    .eq('parent_id', parentId)

  if (!children || children.length === 0) return

  const newDepth = parentDepth + 1

  for (const child of children) {
    await adminClient
      .from('folders')
      .update({ depth: newDepth, updated_at: new Date().toISOString() })
      .eq('id', child.id)

    await updateDescendantDepths(adminClient, child.id, newDepth)
  }
}

// PUT - Move a folder to a different parent
export async function PUT(request, { params }) {
  try {
    const { id: folderId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get the folder being moved
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
    const { parent_id } = body // null = move to root

    // Prevent moving folder into itself
    if (parent_id === folderId) {
      return NextResponse.json(
        { error: 'Cannot move a folder into itself' },
        { status: 400 }
      )
    }

    let newDepth = 0

    if (parent_id) {
      // Get the target parent folder
      const { data: parentFolder, error: parentError } = await adminClient
        .from('folders')
        .select('id, depth, chapter_id')
        .eq('id', parent_id)
        .single()

      if (parentError || !parentFolder) {
        return NextResponse.json({ error: 'Target parent folder not found' }, { status: 404 })
      }

      // Must be same chapter
      if (parentFolder.chapter_id !== folder.chapter_id) {
        return NextResponse.json(
          { error: 'Cannot move folder to a different chapter' },
          { status: 400 }
        )
      }

      // Prevent moving folder into one of its own descendants
      // Walk up from parent_id to ensure we don't hit folderId
      let checkId = parent_id
      while (checkId) {
        if (checkId === folderId) {
          return NextResponse.json(
            { error: 'Cannot move a folder into one of its own subfolders' },
            { status: 400 }
          )
        }
        const { data: ancestor } = await adminClient
          .from('folders')
          .select('parent_id')
          .eq('id', checkId)
          .single()
        checkId = ancestor?.parent_id || null
      }

      newDepth = parentFolder.depth + 1
    }

    // Check depth limits: the folder + its deepest descendant must not exceed max depth 2
    const descendantLevels = await getMaxDescendantDepth(adminClient, folderId)
    if (newDepth + descendantLevels > 2) {
      return NextResponse.json(
        { error: 'Moving this folder here would exceed the maximum nesting depth (3 levels)' },
        { status: 400 }
      )
    }

    // Check for duplicate name at the new location
    let dupQuery = adminClient
      .from('folders')
      .select('id')
      .eq('chapter_id', folder.chapter_id)
      .eq('name', folder.name)
      .neq('id', folderId)

    if (parent_id) {
      dupQuery = dupQuery.eq('parent_id', parent_id)
    } else {
      dupQuery = dupQuery.is('parent_id', null)
    }

    const { data: existing } = await dupQuery

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: 'A folder with this name already exists in the target location' },
        { status: 409 }
      )
    }

    // Move the folder
    const { data: updatedFolder, error: updateError } = await adminClient
      .from('folders')
      .update({
        parent_id: parent_id || null,
        depth: newDepth,
        updated_at: new Date().toISOString(),
      })
      .eq('id', folderId)
      .select()
      .single()

    if (updateError) throw updateError

    // Recursively update child depths
    await updateDescendantDepths(adminClient, folderId, newDepth)

    return NextResponse.json({ folder: updatedFolder })

  } catch (error) {
    console.error('Move folder error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
