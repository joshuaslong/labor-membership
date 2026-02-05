/**
 * Permission utilities for role-based access control
 */

/**
 * Check if user has any of the specified roles
 */
export function hasRole(userRoles, requiredRoles) {
  if (!userRoles || !Array.isArray(userRoles)) return false
  if (!Array.isArray(requiredRoles)) requiredRoles = [requiredRoles]
  return userRoles.some(role => requiredRoles.includes(role))
}

/**
 * Check if user can access a section
 */
export function canAccessSection(userRoles, section) {
  if (!userRoles || !Array.isArray(userRoles)) return false

  // Super admin can access everything
  if (userRoles.includes('super_admin')) return true

  const sectionPermissions = {
    members: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'membership_coordinator', 'data_manager'],
    events: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'event_coordinator'],
    communicate: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'communications_lead'],
    chapters: ['national_admin', 'state_admin', 'county_admin', 'city_admin'],
    resources: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'content_creator'],
    tasks: ['national_admin', 'state_admin', 'county_admin', 'city_admin', 'volunteer_manager'],
    admin: ['super_admin', 'national_admin']
  }

  const allowedRoles = sectionPermissions[section]
  if (!allowedRoles) return false

  return hasRole(userRoles, allowedRoles)
}

/**
 * Get chapter scope for user based on roles
 * Returns null for full access, array of chapter IDs for scoped access
 */
export function getChapterScope(userRoles, userChapterId) {
  if (!userRoles || !Array.isArray(userRoles)) return []

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
 */
export function isAdmin(userRoles) {
  return hasRole(userRoles, ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin'])
}

/**
 * Get highest admin role (for display)
 */
export function getHighestRole(userRoles) {
  const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
  for (const role of roleHierarchy) {
    if (userRoles.includes(role)) return role
  }
  return userRoles[0] || null
}
