import ContextualSidebar from '@/components/ContextualSidebar'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import { canAccessSection } from '@/lib/permissions'

export default async function TasksLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember || !canAccessSection(teamMember.roles, 'tasks')) {
    redirect('/workspace')
  }

  const sidebarItems = [
    { type: 'link', label: 'Create Task', href: '/workspace/tasks/new', variant: 'primary' },
    { type: 'divider' },
    { type: 'link', label: 'My Tasks', href: '/workspace/tasks?owner=me' },
    { type: 'link', label: 'All Tasks', href: '/workspace/tasks' },
    { type: 'header', label: 'By Status' },
    { type: 'link', label: 'Not Started', href: '/workspace/tasks?status=NOT_STARTED' },
    { type: 'link', label: 'In Progress', href: '/workspace/tasks?status=IN_PROGRESS' },
    { type: 'link', label: 'Blocked', href: '/workspace/tasks?status=BLOCKED' },
    { type: 'link', label: 'In Review', href: '/workspace/tasks?status=IN_REVIEW' },
    { type: 'link', label: 'Done', href: '/workspace/tasks?status=DONE' },
    { type: 'header', label: 'By Priority' },
    { type: 'link', label: 'P1 - Critical', href: '/workspace/tasks?priority=P1' },
    { type: 'link', label: 'P2 - High', href: '/workspace/tasks?priority=P2' },
    { type: 'link', label: 'P3 - Standard', href: '/workspace/tasks?priority=P3' },
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
