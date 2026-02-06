import ContextualSidebar from '@/components/ContextualSidebar'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import { canAccessSection } from '@/lib/permissions'

export default async function EventsLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember || !canAccessSection(teamMember.roles, 'events')) {
    redirect('/workspace')
  }

  const sidebarItems = [
    { type: 'link', label: 'Create Event', href: '/workspace/events/new' },
    { type: 'divider' },
    { type: 'link', label: 'All Events', href: '/workspace/events' },
    { type: 'link', label: 'Upcoming', href: '/workspace/events?time=upcoming' },
    { type: 'link', label: 'Past', href: '/workspace/events?time=past' },
    { type: 'header', label: 'By Status' },
    { type: 'link', label: 'Draft', href: '/workspace/events?status=draft' },
    { type: 'link', label: 'Published', href: '/workspace/events?status=published' },
    { type: 'link', label: 'Cancelled', href: '/workspace/events?status=cancelled' }
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
