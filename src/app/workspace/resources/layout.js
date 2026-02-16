import ContextualSidebar from '@/components/ContextualSidebar'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import { canAccessSection, hasRole } from '@/lib/permissions'

export default async function ResourcesLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember || !canAccessSection(teamMember.roles, 'resources')) {
    redirect('/workspace')
  }

  const roles = teamMember.roles
  const isTopAdmin = hasRole(roles, ['super_admin', 'national_admin'])
  const isMediaRole = hasRole(roles, ['communications_lead', 'content_creator'])

  const sidebarItems = [
    { type: 'link', label: 'Upload Files', href: '/workspace/resources/upload', variant: 'primary' },
    { type: 'divider' },
    { type: 'link', label: 'All Files', href: '/workspace/resources' },
    { type: 'link', label: 'Collections', href: '/workspace/resources/collections' },
    { type: 'header', label: 'By Category' },
    { type: 'link', label: 'Public Files', href: '/workspace/resources?bucket=public' },
    ...(teamMember.chapter_id || isTopAdmin ? [
      { type: 'link', label: 'Chapter Documents', href: '/workspace/resources?bucket=chapters' },
    ] : []),
    ...(isMediaRole || isTopAdmin ? [
      { type: 'link', label: 'Social Media', href: '/workspace/resources?bucket=media/social' },
      { type: 'link', label: 'Podcast', href: '/workspace/resources?bucket=media/podcast' },
    ] : []),
    ...(isTopAdmin ? [
      { type: 'link', label: 'Internal Documents', href: '/workspace/resources?bucket=internal-docs' },
    ] : []),
  ]

  return (
    <div className="flex">
      <ContextualSidebar items={sidebarItems} />
      <main
        className="flex-1 min-h-[calc(100vh-61px)] overflow-y-auto"
        data-chapter-id={teamMember.chapter_id || ''}
        data-is-top-admin={isTopAdmin ? 'true' : 'false'}
      >
        {children}
      </main>
    </div>
  )
}
