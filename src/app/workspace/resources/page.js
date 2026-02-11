import { redirect } from 'next/navigation'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { hasRole } from '@/lib/permissions'
import ResourceBrowser from './ResourceBrowser'

export default async function WorkspaceResourcesPage() {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const roles = teamMember.roles
  const isTopAdmin = hasRole(roles, ['super_admin', 'national_admin'])
  const isMediaRole = hasRole(roles, ['communications_lead', 'content_creator'])

  const allowedBuckets = ['public']

  if (teamMember.chapter_id || isTopAdmin) {
    allowedBuckets.push('chapters')
  }
  if (isMediaRole || isTopAdmin) {
    allowedBuckets.push('media/social', 'media/podcast')
  }
  if (isTopAdmin) {
    allowedBuckets.push('internal-docs')
  }

  // Don't pass chapterId — the files API already handles access control
  // via access_tier filtering based on admin role and chapter jurisdiction.
  // Passing chapterId would over-filter and hide files with null or
  // different chapter_id (e.g. public bucket uploads).
  return (
    <ResourceBrowser
      allowedBuckets={allowedBuckets}
    />
  )
}
