import TopNav from '@/components/TopNav'
import { getCurrentTeamMember, getAccessibleSections } from '@/lib/teamMember'
import { redirect } from 'next/navigation'

export default async function WorkspaceLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember) {
    redirect('/login')
  }

  const sections = ['workspace', ...getAccessibleSections(teamMember.roles)]

  return (
    <div className="min-h-screen bg-stone-50">
      <TopNav sections={sections} />
      {children}
    </div>
  )
}
