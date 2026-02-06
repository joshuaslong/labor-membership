import ContextualSidebar from '@/components/ContextualSidebar'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import { canAccessSection } from '@/lib/permissions'

export default async function CommunicateLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember || !canAccessSection(teamMember.roles, 'communicate')) {
    redirect('/workspace')
  }

  const sidebarItems = [
    { type: 'link', label: 'Compose Email', href: '/workspace/communicate', variant: 'primary' },
    { type: 'divider' },
    { type: 'link', label: 'Sent Emails', href: '/workspace/communicate/history' },
    { type: 'header', label: 'Templates' },
    { type: 'link', label: 'Announcement', href: '/workspace/communicate?template=announcement' },
    { type: 'link', label: 'Event Invitation', href: '/workspace/communicate?template=event_invitation' },
    { type: 'link', label: 'Newsletter', href: '/workspace/communicate?template=newsletter' }
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
