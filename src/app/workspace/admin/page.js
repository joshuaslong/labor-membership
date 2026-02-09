import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminDashboardPage() {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Fetch counts in parallel
  const [
    { count: totalMembers },
    { count: activeMembers },
    { count: pendingMembers },
    { count: lapsedMembers },
    { count: totalTeam },
    { count: totalChapters },
    { count: openTasks },
    { count: blockedTasks },
    { data: recentMembers },
    { data: recentTeam },
  ] = await Promise.all([
    supabase.from('members').select('id', { count: 'exact', head: true }),
    supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'lapsed'),
    supabase.from('team_members').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('chapters').select('id', { count: 'exact', head: true }),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['NOT_STARTED', 'IN_PROGRESS', 'IN_REVIEW']),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'BLOCKED'),
    supabase
      .from('members')
      .select('id, first_name, last_name, email, status, joined_date')
      .order('joined_date', { ascending: false })
      .limit(5),
    supabase
      .from('team_members')
      .select('id, user_id, roles, active, created_at, member:members(first_name, last_name)')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // Backfill names for team members with null member_id
  let enrichedTeam = recentTeam || []
  const missingNames = enrichedTeam.filter(tm => !tm.member && tm.user_id)
  if (missingNames.length > 0) {
    const { data: membersByUser } = await adminClient
      .from('members')
      .select('user_id, first_name, last_name')
      .in('user_id', missingNames.map(tm => tm.user_id))

    if (membersByUser) {
      const userMap = new Map(membersByUser.map(m => [m.user_id, m]))
      enrichedTeam = enrichedTeam.map(tm => {
        if (!tm.member && tm.user_id && userMap.has(tm.user_id)) {
          const m = userMap.get(tm.user_id)
          return { ...tm, member: { first_name: m.first_name, last_name: m.last_name } }
        }
        return tm
      })
    }
  }

  const stats = [
    { label: 'Total Members', value: totalMembers || 0, href: '/workspace/members' },
    { label: 'Active', value: activeMembers || 0, color: 'text-green-700' },
    { label: 'Pending', value: pendingMembers || 0, color: 'text-amber-700', href: '/workspace/members?status=pending' },
    { label: 'Lapsed', value: lapsedMembers || 0, color: 'text-orange-700' },
  ]

  const orgStats = [
    { label: 'Team Members', value: totalTeam || 0, href: '/workspace/admin/team' },
    { label: 'Chapters', value: totalChapters || 0, href: '/workspace/admin/chapters' },
    { label: 'Open Tasks', value: openTasks || 0, href: '/workspace/tasks' },
    { label: 'Blocked', value: blockedTasks || 0, color: 'text-red-700', href: '/workspace/tasks?status=BLOCKED' },
  ]

  const roleLabels = {
    super_admin: 'Super Admin',
    national_admin: 'National Admin',
    state_admin: 'State Admin',
    county_admin: 'County Admin',
    city_admin: 'City Admin',
    membership_coordinator: 'Membership',
    event_coordinator: 'Events',
    communications_lead: 'Comms',
    content_creator: 'Content',
    volunteer_manager: 'Volunteers',
    data_manager: 'Data',
  }

  const roleBadgeColor = {
    super_admin: 'text-purple-700 bg-purple-50 border-purple-200',
    national_admin: 'text-red-700 bg-red-50 border-red-200',
    state_admin: 'text-blue-700 bg-blue-50 border-blue-200',
    county_admin: 'text-green-700 bg-green-50 border-green-200',
    city_admin: 'text-amber-700 bg-amber-50 border-amber-200',
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Admin Dashboard</h1>
        <p className="text-xs text-gray-500 mt-0.5">Platform overview and management tools</p>
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickAction href="/workspace/admin/team" label="Manage Team" icon={
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          } />
          <QuickAction href="/workspace/admin/chapters" label="Manage Chapters" icon={
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
          } />
          <QuickAction href="/workspace/admin/tools?tool=import" label="Import Members" icon={
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          } />
          <QuickAction href="/workspace/admin/tools?tool=payments" label="Sync Payments" icon={
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
          } />
        </div>
      </div>

      {/* Membership Stats */}
      <div className="mb-6">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Membership</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(s => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      </div>

      {/* Organization Stats */}
      <div className="mb-6">
        <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Organization</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {orgStats.map(s => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Members */}
        <div className="bg-white border border-stone-200 rounded">
          <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recent Members</h2>
            <Link href="/workspace/members" className="text-xs text-gray-400 hover:text-gray-600">
              View all
            </Link>
          </div>
          <div className="divide-y divide-stone-100">
            {recentMembers?.map(m => (
              <Link
                key={m.id}
                href={`/workspace/members/${m.id}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm text-gray-900 truncate">{m.first_name} {m.last_name}</div>
                  <div className="text-xs text-gray-400 truncate">{m.email}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${
                    m.status === 'active' ? 'text-green-700 bg-green-50 border-green-200' :
                    m.status === 'pending' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                    'text-gray-700 bg-stone-50 border-stone-200'
                  }`}>
                    {m.status}
                  </span>
                  <span className="text-xs text-gray-400 tabular-nums">
                    {new Date(m.joined_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              </Link>
            ))}
            {(!recentMembers || recentMembers.length === 0) && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No members yet</div>
            )}
          </div>
        </div>

        {/* Recent Team Members */}
        <div className="bg-white border border-stone-200 rounded">
          <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Team Members</h2>
            <Link href="/workspace/admin/team" className="text-xs text-gray-400 hover:text-gray-600">
              View all
            </Link>
          </div>
          <div className="divide-y divide-stone-100">
            {enrichedTeam?.map(tm => (
              <Link
                key={tm.id}
                href={`/workspace/admin/team/${tm.id}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-sm text-gray-900 truncate">
                    {tm.member ? `${tm.member.first_name} ${tm.member.last_name}` : 'Unknown'}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                  {tm.roles?.slice(0, 2).map(role => (
                    <span
                      key={role}
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${roleBadgeColor[role] || 'text-gray-700 bg-stone-50 border-stone-200'}`}
                    >
                      {roleLabels[role] || role}
                    </span>
                  ))}
                  {tm.roles?.length > 2 && (
                    <span className="text-xs text-gray-400">+{tm.roles.length - 2}</span>
                  )}
                </div>
              </Link>
            ))}
            {(!enrichedTeam || enrichedTeam.length === 0) && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No team members yet</div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

function StatCard({ label, value, color, href }) {
  const content = (
    <div className="bg-white border border-stone-200 rounded px-4 py-3">
      <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums mt-0.5 ${color || 'text-gray-900'}`}>{value}</div>
    </div>
  )

  if (href) {
    return <Link href={href} className="hover:border-stone-300 transition-colors rounded">{content}</Link>
  }
  return content
}

function QuickAction({ href, label, icon }) {
  return (
    <Link
      href={href}
      className="bg-white border border-stone-200 rounded px-4 py-3 hover:bg-gray-50 hover:border-stone-300 transition-colors flex items-center gap-2.5"
    >
      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {icon}
      </svg>
      <span className="text-sm text-gray-700">{label}</span>
    </Link>
  )
}
