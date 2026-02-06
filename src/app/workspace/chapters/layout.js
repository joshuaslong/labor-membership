import ContextualSidebar from '@/components/ContextualSidebar'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import { canAccessSection } from '@/lib/permissions'

export default async function ChaptersLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember || !canAccessSection(teamMember.roles, 'chapters')) {
    redirect('/workspace')
  }

  const sidebarItems = [
    { type: 'link', label: 'All Chapters', href: '/workspace/chapters' },
    { type: 'header', label: 'By Level' },
    { type: 'link', label: 'National', href: '/workspace/chapters?level=national' },
    { type: 'link', label: 'State', href: '/workspace/chapters?level=state' },
    { type: 'link', label: 'County', href: '/workspace/chapters?level=county' },
    { type: 'link', label: 'City', href: '/workspace/chapters?level=city' },
  ]

  return (
    <div className="flex">
      <ContextualSidebar items={sidebarItems} />
      <main className="flex-1 min-h-[calc(100vh-61px)] overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
