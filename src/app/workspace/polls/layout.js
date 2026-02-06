import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'

export default async function PollsLayout({ children }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  return children
}
