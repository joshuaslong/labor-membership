import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import ContextualSidebar from '@/components/ContextualSidebar'

export default async function PollsLayout({ children }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const sidebarItems = [
    { type: 'link', label: 'All Polls', href: '/workspace/polls', variant: 'primary' },
    { type: 'divider' },
    { type: 'header', label: 'Filter' },
    { type: 'link', label: 'Active', href: '/workspace/polls?status=active' },
    { type: 'link', label: 'Completed', href: '/workspace/polls?status=voted' },
    { type: 'link', label: 'Closed', href: '/workspace/polls?status=closed' },
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
