import ContextualSidebar from '@/components/ContextualSidebar'
import ResponsiveSidebarWrapper from '@/components/ResponsiveSidebarWrapper'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import { canAccessSection } from '@/lib/permissions'

export default async function InitiativesLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember || !canAccessSection(teamMember.roles, 'initiatives')) {
    redirect('/workspace')
  }

  const sidebarItems = [
    { type: 'link', label: 'New Initiative', href: '/workspace/initiatives/new', variant: 'primary' },
    { type: 'divider' },
    { type: 'link', label: 'All Initiatives', href: '/workspace/initiatives' },
    { type: 'header', label: 'By Status' },
    { type: 'link', label: 'Draft', href: '/workspace/initiatives?status=draft' },
    { type: 'link', label: 'Active', href: '/workspace/initiatives?status=active' },
    { type: 'link', label: 'Completed', href: '/workspace/initiatives?status=completed' },
    { type: 'link', label: 'Archived', href: '/workspace/initiatives?status=archived' },
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
