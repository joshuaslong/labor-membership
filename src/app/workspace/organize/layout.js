import ContextualSidebar from '@/components/ContextualSidebar'
import ResponsiveSidebarWrapper from '@/components/ResponsiveSidebarWrapper'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import { canAccessSection } from '@/lib/permissions'

export default async function VolunteersLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember || !canAccessSection(teamMember.roles, 'organize')) {
    redirect('/workspace')
  }

  const sidebarItems = [
    { type: 'link', label: 'Create Opportunity', href: '/workspace/organize/new', variant: 'primary' },
    { type: 'divider' },
    { type: 'link', label: 'All Opportunities', href: '/workspace/organize' },
    { type: 'link', label: 'One-time', href: '/workspace/organize?type=one_time' },
    { type: 'link', label: 'Ongoing', href: '/workspace/organize?type=ongoing' },
    { type: 'header', label: 'By Status' },
    { type: 'link', label: 'Draft', href: '/workspace/organize?status=draft' },
    { type: 'link', label: 'Published', href: '/workspace/organize?status=published' },
    { type: 'link', label: 'Filled', href: '/workspace/organize?status=filled' },
    { type: 'link', label: 'Cancelled', href: '/workspace/organize?status=cancelled' }
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
