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

  return (
    <ResourceBrowser
      allowedBuckets={allowedBuckets}
      chapterId={isTopAdmin ? null : teamMember.chapter_id}
    />
  )
}
