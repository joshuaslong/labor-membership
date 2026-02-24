import { redirect } from 'next/navigation'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { hasRole } from '@/lib/permissions'
import CollectionsList from './CollectionsList'

export default async function CollectionsPage() {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const roles = teamMember.roles
  const isTopAdmin = hasRole(roles, ['super_admin', 'national_admin'])

  return (
    <CollectionsList isTopAdmin={isTopAdmin} />
  )
}
