import ContextualSidebar from '@/components/ContextualSidebar'
import TopNav from '@/components/TopNav'
import { getCurrentTeamMember, getAccessibleSections } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import { canAccessSection } from '@/lib/permissions'

export default async function MembersLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember || !canAccessSection(teamMember.roles, 'members')) {
    redirect('/workspace')
  }

  const sections = ['workspace', ...getAccessibleSections(teamMember.roles)]

  const sidebarItems = [
    { type: 'link', label: 'All Members', href: '/members' },
    { type: 'link', label: 'Pending Approval', href: '/members?status=pending' },
    { type: 'header', label: 'By Segment' },
    { type: 'link', label: 'Donors', href: '/members?segment=donor' },
    { type: 'link', label: 'Volunteers', href: '/members?segment=volunteer' },
    { type: 'link', label: 'Event Attendees', href: '/members?segment=event_attendee' },
    { type: 'link', label: 'Organizers', href: '/members?segment=organizer' },
    { type: 'link', label: 'New Members', href: '/members?segment=new_member' },
    { type: 'divider' },
    { type: 'link', label: 'Import Members', href: '/members/import' }
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
