import { createClient } from '@/lib/supabase/server'

/**
 * Get team member record for current user
 */
export async function getCurrentTeamMember() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: teamMember } = await supabase
    .from('team_members')
    .select('*, chapters(id, name, level)')
    .eq('user_id', user.id)
    .eq('active', true)
    .single()

  return teamMember
}

/**
 * Get accessible sections for user based on roles
 */
export function getAccessibleSections(roles) {
  if (!roles || !Array.isArray(roles)) return []

  const sections = []

  // Check each section
  const sectionChecks = [
    { name: 'members', roles: ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin', 'membership_coordinator', 'data_manager'] },
    { name: 'events', roles: ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin', 'event_coordinator'] },
    { name: 'communicate', roles: ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin', 'communications_lead'] },
    { name: 'chapters', roles: ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin'] },
    { name: 'resources', roles: ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin', 'content_creator'] },
    { name: 'tasks', roles: ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin', 'volunteer_manager'] },
    { name: 'admin', roles: ['super_admin', 'national_admin'] }
  ]

  for (const check of sectionChecks) {
    if (roles.some(role => check.roles.includes(role))) {
      sections.push(check.name)
    }
  }

  return sections
}

/**
 * Check if user has team member access (any role)
 */
export async function hasTeamMemberAccess() {
  const teamMember = await getCurrentTeamMember()
  return teamMember !== null && teamMember.roles.length > 0
}
