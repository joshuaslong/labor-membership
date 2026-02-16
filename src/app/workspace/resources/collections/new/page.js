import { redirect } from 'next/navigation'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { hasRole } from '@/lib/permissions'
import NewCollectionForm from './NewCollectionForm'

export default async function NewCollectionPage() {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const roles = teamMember.roles
  const isTopAdmin = hasRole(roles, ['super_admin', 'national_admin'])

  return (
    <NewCollectionForm isTopAdmin={isTopAdmin} chapterId={teamMember.chapter_id} />
  )
}
