/**
 * Permission utilities for role-based access control
 */

/**
 * Section permissions mapping - defines which roles can access each section
 */
const SECTION_PERMISSIONS = {
  members: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'membership_coordinator', 'data_manager'],
  events: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'event_coordinator'],
  communicate: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'communications_lead'],
  chapters: ['national_admin', 'state_admin', 'county_admin', 'city_admin'],
  resources: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'content_creator'],
  tasks: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'volunteer_manager'],
  admin: ['super_admin', 'national_admin']
}

/**
 * Check if user has any of the specified roles
 * @param {Array<string>} userRoles - Array of user role strings
 * @param {string|Array<string>} requiredRoles - Required role(s) to check
 * @returns {boolean} True if user has at least one of the required roles
 */
export function hasRole(userRoles, requiredRoles) {
  if (!userRoles || !Array.isArray(userRoles)) return false
  if (!Array.isArray(requiredRoles)) requiredRoles = [requiredRoles]
  return userRoles.some(role => requiredRoles.includes(role))
}

/**
 * Check if user can access a section
 * @param {Array<string>} userRoles - Array of user role strings
 * @param {string} section - Section name to check access for
 * @returns {boolean} True if user can access the section
 */
export function canAccessSection(userRoles, section) {
  if (!userRoles || !Array.isArray(userRoles)) return false

  // Super admin can access everything
  if (userRoles.includes('super_admin')) return true

  const allowedRoles = SECTION_PERMISSIONS[section]
  if (!allowedRoles) return false

  return hasRole(userRoles, allowedRoles)
}

/**
 * Get chapter scope for user based on roles
 * @param {Array<string>} userRoles - Array of user role strings
 * @param {string|number} userChapterId - User's chapter ID
 * @returns {null|Object} Returns null for full access or invalid inputs,
 *                        object with {chapterId, includeDescendants} for scoped access
 */
export function getChapterScope(userRoles, userChapterId) {
  // Validate inputs
  if (!userRoles || !Array.isArray(userRoles)) return null
  if (userChapterId === null || userChapterId === undefined || userChapterId === '') return null

  // Full access roles - no filtering
  if (hasRole(userRoles, ['super_admin', 'national_admin'])) {
    return null
  }

  // Geographic admin roles - chapter + descendants (needs RPC call in actual usage)
  if (hasRole(userRoles, ['state_admin', 'county_admin', 'city_admin'])) {
    return { chapterId: userChapterId, includeDescendants: true }
  }

  // Team member roles - only their chapter
  return { chapterId: userChapterId, includeDescendants: false }
}

/**
 * Check if user is admin (any admin role)
 * @param {Array<string>} userRoles - Array of user role strings
 * @returns {boolean} True if user has any admin role
 */
export function isAdmin(userRoles) {
  return hasRole(userRoles, ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin'])
}

/**
 * Get highest admin role (for display)
 * @param {Array<string>} userRoles - Array of user role strings
 * @returns {string|null} Highest role in hierarchy, or first role, or null if no roles
 */
export function getHighestRole(userRoles) {
  if (!userRoles || !Array.isArray(userRoles) || userRoles.length === 0) return null

  const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
  for (const role of roleHierarchy) {
    if (userRoles.includes(role)) return role
  }
  return userRoles[0] || null
}
