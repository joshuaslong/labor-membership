import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import StatCard from '@/components/StatCard'
import QuickActions from '@/components/QuickActions'

export default async function WorkspacePage() {
  const teamMember = await getCurrentTeamMember()

  if (!teamMember) {
    redirect('/login')
  }

  // Placeholder stats - will implement role-specific logic later
  const stats = [
    { label: 'Members', value: '0', subtext: 'Loading...' },
    { label: 'Pending', value: '0', subtext: 'Loading...' },
    { label: 'Events', value: '0', subtext: 'Loading...' },
    { label: 'Tasks', value: '0', subtext: 'Loading...' }
  ]

  const primaryAction = {
    label: 'Import Members',
    href: '/members/import',
    icon: 'M12 4v16m8-8H4'
  }

  const actions = [
    { label: 'View Members', href: '/members' },
    { label: 'Create Event', href: '/events/new' },
    { label: 'Send Email', href: '/communicate' },
    { label: 'View Tasks', href: '/tasks' }
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
            {stats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>

          {/* Recent members placeholder */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Recent Members</h2>
            </div>
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              Coming soon
            </div>
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
