import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Role hierarchy for admin permissions (highest to lowest privilege)
 */
export const ROLE_HIERARCHY = [
  'super_admin',
  'national_admin',
  'state_admin',
  'county_admin',
  'city_admin'
]

/**
 * Authenticates an admin user and returns their admin information.
 * Returns null if user is not authenticated or not an admin.
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.includeChapter - Include chapter details in response (default: false)
 * @returns {Promise<Object|null>} Admin info object or null if not authorized
 */
export async function getAuthenticatedAdmin(options = {}) {
  const {
    includeChapter = false
  } = options

  try {
    // Get authenticated user
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return null
    }

    // Query team_members (single row per user)
    const supabase = createAdminClient()
    const { data: record, error } = await supabase
      .from('team_members')
      .select('id, user_id, roles, chapter_id, is_media_team, member_id, chapters(id, name, state_code, level)')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    if (error || !record) {
      if (error && error.code !== 'PGRST116') {
        console.error('Admin auth query error:', error)
      }
      return null
    }

    // Find highest admin role from roles array
    const highestAdminRole = ROLE_HIERARCHY.find(r => record.roles?.includes(r)) || null

    // User must have at least one admin role
    if (!highestAdminRole) {
      return null
    }

    // Build response object
    const adminInfo = {
      userId: user.id,
      email: user.email,
      role: highestAdminRole,
      roles: record.roles,
      chapterId: record.chapter_id,
      isMediaTeam: record.is_media_team || false,
      teamMemberId: record.id
    }

    if (includeChapter && record.chapters) {
      adminInfo.chapter = record.chapters
    }

    return adminInfo
  } catch (error) {
    console.error('Admin authentication error:', error)
    return null
  }
}

/**
 * Middleware helper that authenticates admin and returns error response if unauthorized.
 * Use this at the start of admin API routes.
 *
 * @param {Object} options - Same options as getAuthenticatedAdmin
 * @returns {Promise<{admin: Object, error: null} | {admin: null, error: NextResponse}>}
 */
export async function requireAdmin(options = {}) {
  const admin = await getAuthenticatedAdmin(options)

  if (!admin) {
    return {
      admin: null,
      error: NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      )
    }
  }

  return { admin, error: null }
}

/**
 * Check if an admin has a specific role or higher privilege
 *
 * @param {string} adminRole - The admin's current role
 * @param {string} requiredRole - The minimum required role
 * @returns {boolean} True if admin has required role or higher
 */
export function hasRole(adminRole, requiredRole) {
  const adminIndex = ROLE_HIERARCHY.indexOf(adminRole)
  const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole)

  if (adminIndex === -1 || requiredIndex === -1) {
    return false
  }

  return adminIndex <= requiredIndex
}

/**
 * Check if an admin is a super admin (super_admin or national_admin)
 *
 * @param {string} role - The admin's role
 * @returns {boolean} True if super admin
 */
export function isSuperAdmin(role) {
  return role === 'super_admin' || role === 'national_admin'
}

/**
 * Get the team member record for a user
 *
 * @param {string} userId - The user ID to query
 * @returns {Promise<Object|null>} Team member record or null
 */
export async function getAdminRecords(userId) {
  try {
    const supabase = createAdminClient()
    const { data: record, error } = await supabase
      .from('team_members')
      .select('id, user_id, roles, chapter_id, is_media_team, member_id')
      .eq('user_id', userId)
      .eq('active', true)
      .single()

    if (error || !record) {
      if (error && error.code !== 'PGRST116') {
        console.error('Get admin records error:', error)
      }
      return null
    }

    return record
  } catch (error) {
    console.error('Get admin records error:', error)
    return null
  }
}
