import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const supabase = createAdminClient()

  const { data: adminRecords } = await supabase
    .from('admin_users')
    .select('id, role, chapter_id, chapters(name)')
    .eq('user_id', user.id)

  if (!adminRecords || adminRecords.length === 0) {
    redirect('/dashboard')
  }

  const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
  const currentAdmin = adminRecords.reduce((highest, current) => {
    const currentIndex = roleHierarchy.indexOf(current.role)
    const highestIndex = roleHierarchy.indexOf(highest.role)
    return currentIndex < highestIndex ? current : highest
  }, adminRecords[0])

  let allowedChapterIds = null
  if (!['super_admin', 'national_admin'].includes(currentAdmin.role)) {
    const { data: descendants } = await supabase
      .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })
    allowedChapterIds = descendants?.map(d => d.id) || []
  }

  let memberIds = []
  if (allowedChapterIds) {
    const { data: memberChapterData } = await supabase
      .from('member_chapters')
      .select('member_id')
      .in('chapter_id', allowedChapterIds)

    memberIds = [...new Set(memberChapterData?.map(mc => mc.member_id) || [])]

    const { data: legacyMembers } = await supabase
      .from('members')
      .select('id')
      .in('chapter_id', allowedChapterIds)

    legacyMembers?.forEach(m => {
      if (!memberIds.includes(m.id)) memberIds.push(m.id)
    })
  }

  let membersQuery = supabase.from('members').select('id, status, chapter_id')
  if (allowedChapterIds && memberIds.length > 0) {
    membersQuery = membersQuery.in('id', memberIds)
  } else if (allowedChapterIds && memberIds.length === 0) {
    membersQuery = membersQuery.eq('id', '00000000-0000-0000-0000-000000000000')
  }
  const { data: members } = await membersQuery

  const memberStats = members?.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1
    acc.total = (acc.total || 0) + 1
    return acc
  }, { total: 0 }) || { total: 0 }

  let chaptersQuery = supabase.from('chapters').select('id, level')
  if (allowedChapterIds) {
    chaptersQuery = chaptersQuery.in('id', allowedChapterIds)
  }
  const { data: chapters } = await chaptersQuery

  const chapterStats = chapters?.reduce((acc, c) => {
    acc[c.level] = (acc[c.level] || 0) + 1
    acc.total = (acc.total || 0) + 1
    return acc
  }, { total: 0 }) || { total: 0 }

  let totalRevenue = 0
  if (allowedChapterIds && memberIds.length > 0) {
    const { data: payments } = await supabase
      .from('payments')
      .select('amount_cents')
      .eq('status', 'succeeded')
      .in('member_id', memberIds)
    totalRevenue = payments?.reduce((sum, p) => sum + p.amount_cents, 0) / 100 || 0
  } else if (!allowedChapterIds) {
    const { data: payments } = await supabase
      .from('payments')
      .select('amount_cents')
      .eq('status', 'succeeded')
    totalRevenue = payments?.reduce((sum, p) => sum + p.amount_cents, 0) / 100 || 0
  }

  let recentMembersQuery = supabase
    .from('members')
    .select('id, first_name, last_name, email, status, joined_date')
    .order('joined_date', { ascending: false })
    .limit(5)

  if (allowedChapterIds) {
    recentMembersQuery = recentMembersQuery.in('chapter_id', allowedChapterIds)
  }
  const { data: recentMembers } = await recentMembersQuery

  const isSuperAdmin = currentAdmin.role === 'super_admin'
  const hasFullDataAccess = ['super_admin', 'national_admin'].includes(currentAdmin.role)
  const canManageAdmins = ['super_admin', 'state_admin', 'county_admin'].includes(currentAdmin.role)

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header bar */}
      <div className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Organizing Dashboard</h1>
            {!hasFullDataAccess && currentAdmin.chapters && (
              <span className="text-sm text-gray-500">
                {currentAdmin.chapters.name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats - dense, functional */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-stone-200 rounded p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-1">Members</div>
            <div className="text-2xl font-semibold text-gray-900 tabular-nums">{memberStats.total}</div>
            <div className="text-xs text-gray-600 mt-0.5">{memberStats.active || 0} active</div>
          </div>
          <div className="bg-white border border-stone-200 rounded p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-1">Pending</div>
            <div className="text-2xl font-semibold text-amber-600 tabular-nums">{memberStats.pending || 0}</div>
            <div className="text-xs text-gray-600 mt-0.5">Need review</div>
          </div>
          <div className="bg-white border border-stone-200 rounded p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-1">Chapters</div>
            <div className="text-2xl font-semibold text-labor-red tabular-nums">{chapterStats.total}</div>
            <div className="text-xs text-gray-600 mt-0.5 font-mono">
              {chapterStats.state || 0}s {chapterStats.county || 0}c {chapterStats.city || 0}ci
            </div>
          </div>
          <div className="bg-white border border-stone-200 rounded p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-1">Revenue</div>
            <div className="text-2xl font-semibold text-green-700 tabular-nums">${totalRevenue.toLocaleString()}</div>
            <div className="text-xs text-gray-600 mt-0.5">Contributions</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent members - 2/3 width */}
          <div className="lg:col-span-2 bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Recent Members</h2>
              <Link href="/members" className="text-xs text-labor-red hover:text-labor-red-600 font-medium">
                View All →
              </Link>
            </div>
            <div className="divide-y divide-stone-100">
              {recentMembers?.length > 0 ? (
                recentMembers.map(member => (
                  <div key={member.id} className="px-4 py-3 flex items-center justify-between hover:bg-stone-50">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {member.first_name} {member.last_name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{member.email}</div>
                    </div>
                    <div className="text-xs text-gray-500 tabular-nums ml-4">
                      {new Date(member.joined_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-center text-sm text-gray-500">No members yet</div>
              )}
            </div>
          </div>

          {/* Quick actions - dense, functional list */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Actions</h2>
            </div>
            <div className="p-2">
              <Link
                href="/admin/import"
                className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium bg-labor-red text-white hover:bg-labor-red-600 transition-colors mb-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Import Members
              </Link>

              <div className="space-y-0.5 mt-2">
                {isSuperAdmin && (
                  <Link href="/admin/chapters/new" className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded">
                    Create Chapter
                  </Link>
                )}
                <Link href="/chapters" className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded">
                  {isSuperAdmin ? 'Manage Chapters' : 'Chapters'}
                </Link>
                <Link href="/members" className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded">
                  {hasFullDataAccess ? 'All Members' : 'Members'}
                </Link>
                <Link href="/members?status=pending" className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded">
                  Pending Members
                </Link>
                <Link href="/admin/events" className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded">
                  Events
                </Link>
                <Link href="/admin/groups" className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded">
                  Groups
                </Link>
                <Link href="/admin/polls" className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded">
                  Polls
                </Link>
                <Link href="/admin/email" className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded">
                  Send Email
                </Link>
                {isSuperAdmin && (
                  <Link href="/admin/email-templates" className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded">
                    Email Templates
                  </Link>
                )}
                {hasFullDataAccess && (
                  <Link href="/admin/initiatives" className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded">
                    Initiatives
                  </Link>
                )}
                <Link href="/admin/files" className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded">
                  Files
                </Link>
                {canManageAdmins && (
                  <Link href="/admin/admins" className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded">
                    Administrators
                  </Link>
                )}
                {isSuperAdmin && (
                  <Link href="/admin/sync-payments" className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded">
                    Sync Payments
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
