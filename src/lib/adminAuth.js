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
 * @param {boolean} options.includeAllRoles - Include all admin role records (default: false)
 * @returns {Promise<Object|null>} Admin info object or null if not authorized
 */
export async function getAuthenticatedAdmin(options = {}) {
  const {
    includeChapter = false,
    includeAllRoles = false
  } = options

  try {
    // Get authenticated user
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return null
    }

    // Query admin records
    const supabase = createAdminClient()
    const query = supabase
      .from('admin_users')
      .select(includeChapter
        ? `id, role, chapter_id, is_media_team, chapters(id, name, state_code, level)`
        : 'id, role, chapter_id, is_media_team'
      )
      .eq('user_id', user.id)

    const { data: adminRecords, error } = await query

    if (error) {
      console.error('Admin auth query error:', error)
      return null
    }

    if (!adminRecords || adminRecords.length === 0) {
      return null
    }

    // Find highest privilege role
    const highestRecord = adminRecords.reduce((highest, current) => {
      const currentIndex = ROLE_HIERARCHY.indexOf(current.role)
      const highestIndex = ROLE_HIERARCHY.indexOf(highest.role)
      return currentIndex < highestIndex ? current : highest
    }, adminRecords[0])

    // Check if user is on media team
    const isMediaTeam = adminRecords.some(a => a.is_media_team)

    // Build response object
    const adminInfo = {
      id: highestRecord.id,
      userId: user.id,
      email: user.email,
      role: highestRecord.role,
      chapterId: highestRecord.chapter_id,
      isMediaTeam
    }

    if (includeChapter && highestRecord.chapters) {
      adminInfo.chapter = highestRecord.chapters
    }

    if (includeAllRoles) {
      adminInfo.allRoles = adminRecords.map(a => ({
        id: a.id,
        role: a.role,
        chapterId: a.chapter_id,
        chapterName: a.chapters?.name,
        isMediaTeam: a.is_media_team
      }))
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
 * Get all admin records for a user (useful when checking multiple chapter access)
 *
 * @param {string} userId - The user ID to query
 * @returns {Promise<Array>} Array of admin records or empty array
 */
export async function getAdminRecords(userId) {
  try {
    const supabase = createAdminClient()
    const { data: adminRecords, error } = await supabase
      .from('admin_users')
      .select('id, role, chapter_id, is_media_team')
      .eq('user_id', userId)

    if (error) {
      console.error('Get admin records error:', error)
      return []
    }

    return adminRecords || []
  } catch (error) {
    console.error('Get admin records error:', error)
    return []
  }
}
