import { redirect } from 'next/navigation'
import { getCurrentTeamMember } from '@/lib/teamMember'
import CollectionEditor from './CollectionEditor'

export default async function CollectionEditPage({ params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const { id } = await params

  return (
    <CollectionEditor collectionId={id} />
  )
}
