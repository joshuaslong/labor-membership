import { redirect } from 'next/navigation'
import Link from 'next/link'
import StatCard from '@/components/StatCard'
import QuickActions from '@/components/QuickActions'
import SegmentBadge from '@/components/SegmentBadge'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { getWorkspaceStats, getRecentMembers } from '@/lib/workspaceStats'

export default async function WorkspacePage() {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember) {
    redirect('/login')
  }

  const [statsData, recentMembers] = await Promise.all([
    getWorkspaceStats(teamMember),
    getRecentMembers(teamMember)
  ])

  const stats = [
    { label: 'Members', value: statsData.members, subtext: `${statsData.pending} pending` },
    { label: 'Pending', value: statsData.pending, subtext: 'Need review', valueColor: 'text-amber-600' },
    { label: 'Events', value: statsData.events, subtext: 'This month' },
    { label: 'Tasks', value: statsData.tasks, subtext: 'Assigned to you' }
  ]

  const primaryAction = {
    label: 'Import Members',
    href: '/workspace/members/import',
    icon: 'M12 4v16m8-8H4'
  }

  const actions = [
    { label: 'View Members', href: '/workspace/members' },
    { label: 'Create Event', href: '/workspace/events/new' },
    { label: 'Send Email', href: '/workspace/communicate' },
    { label: 'View Tasks', href: '/workspace/tasks' }
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">ORGANIZING WORKSPACE</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Stats and recent activity - 2/3 width */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 mb-6">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} />
            ))}
          </div>

          {/* Recent members */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Recent Members</h2>
              <Link href="/workspace/members" className="text-xs text-gray-500 hover:text-gray-700">View all</Link>
            </div>
            {recentMembers.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No members yet
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {recentMembers.map(member => (
                  <li key={member.id}>
                    <Link href={`/workspace/members/${member.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-stone-50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{member.first_name} {member.last_name}</p>
                        <p className="text-xs text-gray-500 truncate">{member.email}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        {member.member_segments?.map(seg => (
                          <SegmentBadge key={seg.segment} segment={seg.segment} />
                        ))}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          member.status === 'active' ? 'bg-green-50 text-green-700' :
                          member.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                          'bg-gray-50 text-gray-700'
                        }`}>
                          {member.status}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Quick actions - 1/3 width */}
        <div>
          <QuickActions primaryAction={primaryAction} actions={actions} />
        </div>
      </div>
    </div>
  )
}
