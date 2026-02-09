import ContextualSidebar from '@/components/ContextualSidebar'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import { canAccessSection } from '@/lib/permissions'

export default async function AdminLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember || !canAccessSection(teamMember.roles, 'admin')) {
    redirect('/workspace')
  }

  const isSuperAdmin = teamMember.roles.includes('super_admin')

  const sidebarItems = [
    { type: 'link', label: 'Dashboard', href: '/workspace/admin' },
    { type: 'divider' },
    { type: 'header', label: 'People' },
    { type: 'link', label: 'Team Members', href: '/workspace/admin/team' },
    { type: 'header', label: 'Organization' },
    { type: 'link', label: 'Chapters', href: '/workspace/admin/chapters' },
    { type: 'link', label: 'Groups', href: '/workspace/admin/groups' },
    { type: 'divider' },
    { type: 'header', label: 'Tools' },
    { type: 'link', label: 'Import Members', href: '/workspace/admin/tools?tool=import' },
    { type: 'link', label: 'Sync Payments', href: '/workspace/admin/tools?tool=payments' },
    ...(isSuperAdmin ? [
      { type: 'link', label: 'Email Templates', href: '/workspace/admin/tools?tool=templates' },
    ] : []),
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
