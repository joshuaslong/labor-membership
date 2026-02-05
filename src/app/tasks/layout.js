import ContextualSidebar from '@/components/ContextualSidebar'
import TopNav from '@/components/TopNav'
import { getCurrentTeamMember, getAccessibleSections } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import { canAccessSection } from '@/lib/permissions'

export default async function TasksLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember || !canAccessSection(teamMember.roles, 'tasks')) {
    redirect('/workspace')
  }

  const sections = ['workspace', ...getAccessibleSections(teamMember.roles)]

  const sidebarItems = [
    { type: 'link', label: 'My Tasks', href: '/tasks?owner=me' },
    { type: 'link', label: 'All Tasks', href: '/tasks' },
    { type: 'header', label: 'By Status' },
    { type: 'link', label: 'Not Started', href: '/tasks?status=NOT_STARTED' },
    { type: 'link', label: 'In Progress', href: '/tasks?status=IN_PROGRESS' },
    { type: 'link', label: 'Blocked', href: '/tasks?status=BLOCKED' },
    { type: 'link', label: 'In Review', href: '/tasks?status=IN_REVIEW' },
    { type: 'link', label: 'Done', href: '/tasks?status=DONE' },
    { type: 'header', label: 'By Priority' },
    { type: 'link', label: 'P1 - Critical', href: '/tasks?priority=P1' },
    { type: 'link', label: 'P2 - High', href: '/tasks?priority=P2' },
    { type: 'link', label: 'P3 - Standard', href: '/tasks?priority=P3' },
    { type: 'divider' },
    { type: 'link', label: 'Create Task', href: '/tasks/new' }
  ]

  return (
    <div className="min-h-screen bg-stone-50">
      <TopNav sections={sections} />
      <div className="flex">
        <ContextualSidebar items={sidebarItems} />
        <main className="flex-1 min-h-[calc(100vh-61px)] overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
