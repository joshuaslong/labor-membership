import ContextualSidebar from '@/components/ContextualSidebar'
import ResponsiveSidebarWrapper from '@/components/ResponsiveSidebarWrapper'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import { canAccessSection } from '@/lib/permissions'

export default async function MembersLayout({ children }) {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember || !canAccessSection(teamMember.roles, 'members')) {
    redirect('/workspace')
  }

  const sidebarItems = [
    { type: 'link', label: 'All Members', href: '/workspace/members' },
    { type: 'link', label: 'Pending Approval', href: '/workspace/members?status=pending' },
    { type: 'header', label: 'By Segment' },
    { type: 'link', label: 'Donors', href: '/workspace/members?segment=donor' },
    { type: 'link', label: 'Volunteers', href: '/workspace/members?segment=volunteer' },
    { type: 'link', label: 'Event Attendees', href: '/workspace/members?segment=event_attendee' },
    { type: 'link', label: 'Organizers', href: '/workspace/members?segment=organizer' },
    { type: 'link', label: 'New Members', href: '/workspace/members?segment=new_member' },
    { type: 'divider' },
    { type: 'link', label: 'Import Members', href: '/workspace/members/import' }
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
