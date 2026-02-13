import ContextualSidebar from '@/components/ContextualSidebar'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import { canAccessSection } from '@/lib/permissions'

export default async function VolunteersLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember || !canAccessSection(teamMember.roles, 'volunteers')) {
    redirect('/workspace')
  }

  const sidebarItems = [
    { type: 'link', label: 'Create Opportunity', href: '/workspace/volunteers/new', variant: 'primary' },
    { type: 'divider' },
    { type: 'link', label: 'All Opportunities', href: '/workspace/volunteers' },
    { type: 'link', label: 'One-time', href: '/workspace/volunteers?type=one_time' },
    { type: 'link', label: 'Ongoing', href: '/workspace/volunteers?type=ongoing' },
    { type: 'header', label: 'By Status' },
    { type: 'link', label: 'Draft', href: '/workspace/volunteers?status=draft' },
    { type: 'link', label: 'Published', href: '/workspace/volunteers?status=published' },
    { type: 'link', label: 'Filled', href: '/workspace/volunteers?status=filled' },
    { type: 'link', label: 'Cancelled', href: '/workspace/volunteers?status=cancelled' }
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
