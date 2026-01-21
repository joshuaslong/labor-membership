import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET - List admins the current user can see/manage
export async function GET(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get current user's admin record
    const { data: currentAdmin } = await adminClient
      .from('admin_users')
      .select('id, role, chapter_id')
      .eq('user_id', user.id)
      .single()

    if (!currentAdmin) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    // Get all admins with their chapter and member info
    let query = adminClient
      .from('admin_users')
      .select(`
        id,
        user_id,
        role,
        chapter_id,
        created_at,
        chapters (
          id,
          name,
          level,
          state_code
        )
      `)
      .order('created_at', { ascending: false })

    const { data: admins, error } = await query

    if (error) throw error

    // Get member info for each admin
    const adminUserIds = admins.map(a => a.user_id)
    const { data: members } = await adminClient
      .from('members')
      .select('id, user_id, first_name, last_name, email')
      .in('user_id', adminUserIds)

    // Also get auth emails for admins without member records
    const { data: authUsers } = await adminClient.auth.admin.listUsers()

    // Get descendant chapter IDs for the current admin's chapter (for can_manage check)
    let descendantIds = new Set()
    if (currentAdmin.role !== 'super_admin' && currentAdmin.chapter_id) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })
      descendantIds = new Set(descendants?.map(d => d.id) || [])
    }

    // Merge data and filter based on permissions
    const enrichedAdmins = admins.map(admin => {
      const member = members?.find(m => m.user_id === admin.user_id)
      const authUser = authUsers?.users?.find(u => u.id === admin.user_id)

      // Determine if current user can manage this admin
      let canManage = false
      if (currentAdmin.role === 'super_admin') {
        canManage = true
      } else if (currentAdmin.role !== 'national_admin' && admin.chapter_id) {
        // Can manage if admin's chapter is in our jurisdiction
        // and they're not a super_admin or national_admin
        canManage = descendantIds.has(admin.chapter_id) &&
          !['super_admin', 'national_admin'].includes(admin.role)
      }

      return {
        ...admin,
        member_id: member?.id || null,
        email: member?.email || authUser?.email || 'Unknown',
        first_name: member?.first_name || '',
        last_name: member?.last_name || '',
        can_manage: canManage
      }
    })

    // Filter: super_admin and national_admin see all, others see only their jurisdiction
    let filteredAdmins = enrichedAdmins
    if (!['super_admin', 'national_admin'].includes(currentAdmin.role)) {
      // Get descendant chapter IDs for the current admin's chapter
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })

      const descendantIds = new Set(descendants?.map(d => d.id) || [])

      filteredAdmins = enrichedAdmins.filter(admin =>
        admin.chapter_id && descendantIds.has(admin.chapter_id)
      )
    }

    return NextResponse.json({ admins: filteredAdmins })

  } catch (error) {
    console.error('Error fetching admins:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create a new admin
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get current user's admin record
    const { data: currentAdmin } = await adminClient
      .from('admin_users')
      .select('id, role, chapter_id')
      .eq('user_id', user.id)
      .single()

    if (!currentAdmin) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    const body = await request.json()
    let { email, role, chapter_id } = body

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 })
    }

    // Validate role - only super_admin can create national_admin or super_admin
    const validRoles = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    if (['national_admin', 'super_admin'].includes(role) && currentAdmin.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can create national or super admins' }, { status: 403 })
    }

    // For national/super admin, auto-assign to national chapter if no chapter provided
    if (['national_admin', 'super_admin'].includes(role) && !chapter_id) {
      const { data: nationalChapter } = await adminClient
        .from('chapters')
        .select('id')
        .eq('level', 'national')
        .single()

      if (nationalChapter) {
        chapter_id = nationalChapter.id
      } else {
        return NextResponse.json({ error: 'No national chapter found. Please create one first.' }, { status: 400 })
      }
    }

    if (!chapter_id) {
      return NextResponse.json({ error: 'Chapter is required for this role' }, { status: 400 })
    }

    // Check if current admin can manage the target chapter
    // national_admin cannot create any admins
    if (currentAdmin.role === 'national_admin') {
      return NextResponse.json({ error: 'National admins cannot manage other admins' }, { status: 403 })
    }
    if (currentAdmin.role !== 'super_admin') {
      const { data: canManage } = await adminClient
        .rpc('can_manage_chapter', {
          admin_user_id: user.id,
          target_chapter_id: chapter_id
        })

      if (!canManage) {
        return NextResponse.json({ error: 'You cannot assign admins to this chapter' }, { status: 403 })
      }
    }

    // Find the user by email - first check members table
    let targetUserId = null
    const { data: member } = await adminClient
      .from('members')
      .select('user_id, email')
      .eq('email', email.toLowerCase())
      .single()

    if (member?.user_id) {
      targetUserId = member.user_id
    } else {
      // Check auth users directly
      const { data: authUsers } = await adminClient.auth.admin.listUsers()
      const authUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (authUser) {
        targetUserId = authUser.id
      }
    }

    if (!targetUserId) {
      return NextResponse.json({
        error: 'User not found. They must have an account before being made an admin.'
      }, { status: 404 })
    }

    // Check if already an admin
    const { data: existingAdmin } = await adminClient
      .from('admin_users')
      .select('id')
      .eq('user_id', targetUserId)
      .single()

    if (existingAdmin) {
      return NextResponse.json({ error: 'User is already an admin' }, { status: 400 })
    }

    // Create the admin record
    const { data: newAdmin, error } = await adminClient
      .from('admin_users')
      .insert({
        user_id: targetUserId,
        role,
        chapter_id
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ admin: newAdmin })

  } catch (error) {
    console.error('Error creating admin:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update an existing admin's role or chapter
export async function PUT(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get current user's admin record
    const { data: currentAdmin } = await adminClient
      .from('admin_users')
      .select('id, role, chapter_id')
      .eq('user_id', user.id)
      .single()

    if (!currentAdmin) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    const body = await request.json()
    const { admin_id, role, chapter_id } = body

    if (!admin_id) {
      return NextResponse.json({ error: 'admin_id is required' }, { status: 400 })
    }

    // Get the target admin
    const { data: targetAdmin } = await adminClient
      .from('admin_users')
      .select('id, role, chapter_id, user_id')
      .eq('id', admin_id)
      .single()

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Only super_admin can update super_admin or national_admin
    if (['super_admin', 'national_admin'].includes(targetAdmin.role) && currentAdmin.role !== 'super_admin') {
      return NextResponse.json({ error: 'Cannot modify this admin type' }, { status: 403 })
    }

    // national_admin cannot modify any admins
    if (currentAdmin.role === 'national_admin') {
      return NextResponse.json({ error: 'National admins cannot manage other admins' }, { status: 403 })
    }

    // Only super_admin can set national_admin role
    if (role === 'national_admin' && currentAdmin.role !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can create national admins' }, { status: 403 })
    }

    // Check if current admin can manage the target's current chapter
    if (currentAdmin.role !== 'super_admin') {
      const { data: canManage } = await adminClient
        .rpc('can_manage_admin', {
          manager_user_id: user.id,
          target_admin_id: admin_id
        })

      if (!canManage) {
        return NextResponse.json({ error: 'You cannot modify this admin' }, { status: 403 })
      }

      // Also check if they can manage the new chapter if it's changing
      if (chapter_id && chapter_id !== targetAdmin.chapter_id) {
        const { data: canManageNewChapter } = await adminClient
          .rpc('can_manage_chapter', {
            admin_user_id: user.id,
            target_chapter_id: chapter_id
          })

        if (!canManageNewChapter) {
          return NextResponse.json({ error: 'You cannot assign admins to this chapter' }, { status: 403 })
        }
      }
    }

    // Build update object
    const updateData = {}
    if (role) updateData.role = role

    // Handle chapter assignment
    if (chapter_id) {
      updateData.chapter_id = chapter_id
    } else if (['national_admin', 'super_admin'].includes(role)) {
      // For national/super admin, auto-assign to national chapter if no chapter provided
      const { data: nationalChapter } = await adminClient
        .from('chapters')
        .select('id')
        .eq('level', 'national')
        .single()

      if (nationalChapter) {
        updateData.chapter_id = nationalChapter.id
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }

    // Update the admin
    const { data: updatedAdmin, error } = await adminClient
      .from('admin_users')
      .update(updateData)
      .eq('id', admin_id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ admin: updatedAdmin })

  } catch (error) {
    console.error('Error updating admin:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Remove an admin
export async function DELETE(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get current user's admin record
    const { data: currentAdmin } = await adminClient
      .from('admin_users')
      .select('id, role, chapter_id')
      .eq('user_id', user.id)
      .single()

    if (!currentAdmin) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get('id')

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID required' }, { status: 400 })
    }

    // Can't delete yourself
    if (adminId === currentAdmin.id) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
    }

    // Get the target admin
    const { data: targetAdmin } = await adminClient
      .from('admin_users')
      .select('id, role, chapter_id, user_id')
      .eq('id', adminId)
      .single()

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Can't delete super_admins or national_admins unless you're a super_admin
    if (['super_admin', 'national_admin'].includes(targetAdmin.role) && currentAdmin.role !== 'super_admin') {
      return NextResponse.json({ error: 'Cannot remove this admin type' }, { status: 403 })
    }

    // national_admin cannot delete any admins
    if (currentAdmin.role === 'national_admin') {
      return NextResponse.json({ error: 'National admins cannot manage other admins' }, { status: 403 })
    }

    // Check permissions
    if (currentAdmin.role !== 'super_admin') {
      const { data: canManage } = await adminClient
        .rpc('can_manage_admin', {
          manager_user_id: user.id,
          target_admin_id: adminId
        })

      if (!canManage) {
        return NextResponse.json({ error: 'You cannot remove this admin' }, { status: 403 })
      }
    }

    // Delete the admin record
    const { error } = await adminClient
      .from('admin_users')
      .delete()
      .eq('id', adminId)

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error removing admin:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
