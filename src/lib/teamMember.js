import { createClient } from '@/lib/supabase/server'
import { canAccessSection } from '@/lib/permissions'

/**
 * All available sections in the application
 */
const ALL_SECTIONS = ['members', 'events', 'communicate', 'chapters', 'resources', 'polls', 'tasks', 'admin']

/**
 * Get team member record for current user
 */
export async function getCurrentTeamMember() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: teamMember, error } = await supabase
    .from('team_members')
    .select('*, chapters(id, name, level)')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  if (error) {
    console.error('Error fetching team member:', error)
    return null
  }

  return teamMember
}

/**
 * Get accessible sections for user based on roles
 */
export function getAccessibleSections(roles) {
  if (!roles || !Array.isArray(roles)) return []

  // Super admin has access to everything
  if (roles.includes('super_admin')) {
    return [...ALL_SECTIONS]
  }

  const sections = []

  // Check each section using the shared permissions logic
  for (const section of ALL_SECTIONS) {
    if (canAccessSection(roles, section)) {
      sections.push(section)
    }
  }

  return sections
}

/**
 * Check if user has team member access (any role)
 */
export async function hasTeamMemberAccess() {
  const teamMember = await getCurrentTeamMember()
  return teamMember !== null && teamMember?.roles?.length > 0
}
