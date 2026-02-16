import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']

function getHighestRole(roles) {
  if (!roles || roles.length === 0) return null
  let bestIndex = Infinity
  let bestRole = null
  for (const r of roles) {
    const idx = roleHierarchy.indexOf(r)
    if (idx !== -1 && idx < bestIndex) {
      bestIndex = idx
      bestRole = r
    }
  }
  return bestRole
}

// GET - List admins the current user can see/manage
export async function GET(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get current user's team member record
    const { data: currentTeamMember } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    const currentHighestRole = getHighestRole(currentTeamMember?.roles)
    if (!currentTeamMember || !currentHighestRole) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    // Get all active team members with admin roles
    const { data: teamMembers, error } = await adminClient
      .from('team_members')
      .select(`
        id,
        user_id,
        roles,
        chapter_id,
        is_media_team,
        created_at,
        chapters (
          id,
          name,
          level,
          state_code
        )
      `)
      .eq('active', true)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Filter to only team members that have at least one admin role
    const adminRoleSet = new Set(roleHierarchy)
    const admins = (teamMembers || []).filter(tm =>
      tm.roles?.some(r => adminRoleSet.has(r))
    )

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
    if (currentHighestRole !== 'super_admin' && currentTeamMember.chapter_id) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: currentTeamMember.chapter_id })
      descendantIds = new Set(descendants?.map(d => d.id) || [])
    }

    // Merge data and determine permissions
    const enrichedAdmins = admins.map(admin => {
      const member = members?.find(m => m.user_id === admin.user_id)
      const authUser = authUsers?.users?.find(u => u.id === admin.user_id)
      const adminHighestRole = getHighestRole(admin.roles)

      // Determine if current user can manage this admin
      let canManage = false
      if (currentHighestRole === 'super_admin') {
        canManage = true
      } else if (currentHighestRole === 'national_admin') {
        // National admins can manage state/county/city admins
        canManage = !admin.roles?.some(r => ['super_admin', 'national_admin'].includes(r))
      } else if (admin.chapter_id) {
        // Can manage if admin's chapter is in our jurisdiction
        // and they don't have super_admin or national_admin
        canManage = descendantIds.has(admin.chapter_id) &&
          !admin.roles?.some(r => ['super_admin', 'national_admin'].includes(r))
      }

      return {
        id: admin.id,
        user_id: admin.user_id,
        role: adminHighestRole,
        roles: admin.roles,
        chapter_id: admin.chapter_id,
        is_media_team: admin.is_media_team,
        created_at: admin.created_at,
        chapters: admin.chapters,
        member_id: member?.id || null,
        email: member?.email || authUser?.email || 'Unknown',
        first_name: member?.first_name || '',
        last_name: member?.last_name || '',
        can_manage: canManage
      }
    })

    // Filter: super_admin and national_admin see all, others see only their jurisdiction
    let filteredAdmins = enrichedAdmins
    if (!['super_admin', 'national_admin'].includes(currentHighestRole)) {
      const { data: descendants } = await adminClient
        .rpc('get_chapter_descendants', { chapter_uuid: currentTeamMember.chapter_id })

      const descIds = new Set(descendants?.map(d => d.id) || [])

      filteredAdmins = enrichedAdmins.filter(admin =>
        admin.chapter_id && descIds.has(admin.chapter_id)
      )
    }

    return NextResponse.json({ admins: filteredAdmins })

  } catch (error) {
    console.error('Error fetching admins:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create a new admin (add role to team_members)
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get current user's team member record
    const { data: currentTeamMember } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    const currentHighestRole = getHighestRole(currentTeamMember?.roles)
    if (!currentTeamMember || !currentHighestRole) {
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
    if (['national_admin', 'super_admin'].includes(role) && currentHighestRole !== 'super_admin') {
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
    if (currentHighestRole !== 'super_admin') {
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
      .select('id, user_id, email')
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
        // Link auth user to member record if member exists but wasn't linked
        if (member && !member.user_id) {
          await adminClient
            .from('members')
            .update({ user_id: authUser.id })
            .eq('id', member.id)
        }
      }
    }

    // If member exists but has no account, invite them via Supabase Auth
    if (!targetUserId && member) {
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        email.toLowerCase()
      )

      if (inviteError) {
        return NextResponse.json({
          error: `Failed to invite member: ${inviteError.message}`
        }, { status: 500 })
      }

      targetUserId = inviteData.user.id

      // Link the new auth user to the member record
      await adminClient
        .from('members')
        .update({ user_id: targetUserId })
        .eq('id', member.id)
    }

    if (!targetUserId) {
      return NextResponse.json({
        error: 'No member found with this email. Add them as a member first.'
      }, { status: 404 })
    }

    // Check if user already has a team_members record
    const { data: existingTeamMember } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id, active')
      .eq('user_id', targetUserId)
      .single()

    if (existingTeamMember) {
      // Check if they already have this role
      if (existingTeamMember.roles?.includes(role)) {
        return NextResponse.json({ error: 'User already has this admin role' }, { status: 400 })
      }

      // Add the new role to existing record
      const updatedRoles = [...(existingTeamMember.roles || []), role]
      const updateData = { roles: updatedRoles, active: true }

      // Update chapter to the new role's chapter if this role is higher priority
      const existingHighest = getHighestRole(existingTeamMember.roles)
      const newHighest = getHighestRole(updatedRoles)
      if (newHighest === role) {
        updateData.chapter_id = chapter_id
      }

      const { data: updatedAdmin, error: updateError } = await adminClient
        .from('team_members')
        .update(updateData)
        .eq('id', existingTeamMember.id)
        .select()
        .single()

      if (updateError) throw updateError

      return NextResponse.json({ admin: updatedAdmin })
    } else {
      // Create new team_members record
      const { data: newAdmin, error: insertError } = await adminClient
        .from('team_members')
        .insert({
          user_id: targetUserId,
          member_id: member?.id || null,
          chapter_id,
          roles: [role],
          active: true,
        })
        .select()
        .single()

      if (insertError) throw insertError

      return NextResponse.json({ admin: newAdmin })
    }

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

    // Get current user's team member record
    const { data: currentTeamMember } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    const currentHighestRole = getHighestRole(currentTeamMember?.roles)
    if (!currentTeamMember || !currentHighestRole) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    const body = await request.json()
    const { admin_id, role, chapter_id } = body

    if (!admin_id) {
      return NextResponse.json({ error: 'admin_id is required' }, { status: 400 })
    }

    // Get the target team member
    const { data: targetAdmin } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id, user_id')
      .eq('id', admin_id)
      .eq('active', true)
      .single()

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    const targetHighestRole = getHighestRole(targetAdmin.roles)

    // Only super_admin can update super_admin or national_admin
    if (targetAdmin.roles?.some(r => ['super_admin', 'national_admin'].includes(r)) && currentHighestRole !== 'super_admin') {
      return NextResponse.json({ error: 'Cannot modify this admin type' }, { status: 403 })
    }

    // Only super_admin can set national_admin role
    if (role === 'national_admin' && currentHighestRole !== 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can create national admins' }, { status: 403 })
    }

    // Check if current admin can manage the target
    if (currentHighestRole !== 'super_admin') {
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

    if (role) {
      // Replace the highest admin role with the new role, keep other roles
      const adminRoleSet = new Set(roleHierarchy)
      const nonAdminRoles = (targetAdmin.roles || []).filter(r => !adminRoleSet.has(r))
      updateData.roles = [...nonAdminRoles, role]
    }

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

    // Update the team member
    const { data: updatedAdmin, error } = await adminClient
      .from('team_members')
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

// DELETE - Remove an admin role
export async function DELETE(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Get current user's team member record
    const { data: currentTeamMember } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    const currentHighestRole = getHighestRole(currentTeamMember?.roles)
    if (!currentTeamMember || !currentHighestRole) {
      return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get('id')

    if (!adminId) {
      return NextResponse.json({ error: 'Admin ID required' }, { status: 400 })
    }

    // Can't delete yourself
    if (adminId === currentTeamMember.id) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
    }

    // Get the target team member
    const { data: targetAdmin } = await adminClient
      .from('team_members')
      .select('id, roles, chapter_id, user_id')
      .eq('id', adminId)
      .eq('active', true)
      .single()

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 })
    }

    // Can't delete super_admins or national_admins unless you're a super_admin
    if (targetAdmin.roles?.some(r => ['super_admin', 'national_admin'].includes(r)) && currentHighestRole !== 'super_admin') {
      return NextResponse.json({ error: 'Cannot remove this admin type' }, { status: 403 })
    }

    // Check permissions
    if (currentHighestRole !== 'super_admin') {
      const { data: canManage } = await adminClient
        .rpc('can_manage_admin', {
          manager_user_id: user.id,
          target_admin_id: adminId
        })

      if (!canManage) {
        return NextResponse.json({ error: 'You cannot remove this admin' }, { status: 403 })
      }
    }

    // Remove all admin roles from the team member
    const adminRoleSet = new Set(roleHierarchy)
    const remainingRoles = (targetAdmin.roles || []).filter(r => !adminRoleSet.has(r))

    if (remainingRoles.length === 0) {
      // No roles left - deactivate
      const { error } = await adminClient
        .from('team_members')
        .update({ roles: [], active: false })
        .eq('id', adminId)

      if (error) throw error
    } else {
      // Keep non-admin roles
      const { error } = await adminClient
        .from('team_members')
        .update({ roles: remainingRoles })
        .eq('id', adminId)

      if (error) throw error
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error removing admin:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
