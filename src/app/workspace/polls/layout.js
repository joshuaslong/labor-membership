import ContextualSidebar from '@/components/ContextualSidebar'
import ResponsiveSidebarWrapper from '@/components/ResponsiveSidebarWrapper'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import { canAccessSection } from '@/lib/permissions'

export default async function PollsLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember || !canAccessSection(teamMember.roles, 'polls')) {
    redirect('/workspace')
  }

  const sidebarItems = [
    { type: 'link', label: 'Create Poll', href: '/workspace/polls/new', variant: 'primary' },
    { type: 'divider' },
    { type: 'link', label: 'All Polls', href: '/workspace/polls' },
    { type: 'header', label: 'Filter' },
    { type: 'link', label: 'Needs Vote', href: '/workspace/polls?filter=needs_vote' },
    { type: 'link', label: 'Voted', href: '/workspace/polls?filter=voted' },
    { type: 'link', label: 'Closed', href: '/workspace/polls?filter=closed' },
  ]

  return (
    <div className="flex">
      <ResponsiveSidebarWrapper>
        <ContextualSidebar items={sidebarItems} />
      </ResponsiveSidebarWrapper>
      <main className="flex-1 min-h-[calc(100vh-61px)] overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
