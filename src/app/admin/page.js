import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  // Verify admin access (defense in depth - middleware handles redirect)
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const supabase = createAdminClient()

  // Get current admin's role and chapter (user can have multiple admin records)
  const { data: adminRecords } = await supabase
    .from('admin_users')
    .select('id, role, chapter_id, chapters(name)')
    .eq('user_id', user.id)

  if (!adminRecords || adminRecords.length === 0) {
    redirect('/dashboard')
  }

  // Use highest privilege role for determining access
  const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
  const currentAdmin = adminRecords.reduce((highest, current) => {
    const currentIndex = roleHierarchy.indexOf(current.role)
    const highestIndex = roleHierarchy.indexOf(highest.role)
    return currentIndex < highestIndex ? current : highest
  }, adminRecords[0])

  // Get chapter IDs this admin can access
  // super_admin and national_admin have access to all data
  let allowedChapterIds = null
  if (!['super_admin', 'national_admin'].includes(currentAdmin.role)) {
    const { data: descendants } = await supabase
      .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })
    allowedChapterIds = descendants?.map(d => d.id) || []
  }

  // Get member stats (filtered by chapter for non-super admins)
  // Use member_chapters junction table for accurate counts
  let memberIds = []
  if (allowedChapterIds) {
    // Get members in allowed chapters via member_chapters junction table
    const { data: memberChapterData } = await supabase
      .from('member_chapters')
      .select('member_id')
      .in('chapter_id', allowedChapterIds)

    memberIds = [...new Set(memberChapterData?.map(mc => mc.member_id) || [])]

    // Also include members with legacy chapter_id that aren't in member_chapters
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
    // No members in allowed chapters
    membersQuery = membersQuery.eq('id', '00000000-0000-0000-0000-000000000000') // Will return empty
  }
  const { data: members } = await membersQuery

  const memberStats = members?.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1
    acc.total = (acc.total || 0) + 1
    return acc
  }, { total: 0 }) || { total: 0 }

  // Get chapter counts by level (filtered for non-super admins)
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

  // Get payment totals (filtered by member's chapter for non-super admins)
  let totalRevenue = 0
  if (allowedChapterIds && memberIds.length > 0) {
    // Use the memberIds from member_chapters junction table
    const { data: payments } = await supabase
      .from('payments')
      .select('amount_cents')
      .eq('status', 'succeeded')
      .in('member_id', memberIds)
    totalRevenue = payments?.reduce((sum, p) => sum + p.amount_cents, 0) / 100 || 0
  } else if (!allowedChapterIds) {
    // Super admin sees all payments
    const { data: payments } = await supabase
      .from('payments')
      .select('amount_cents')
      .eq('status', 'succeeded')
    totalRevenue = payments?.reduce((sum, p) => sum + p.amount_cents, 0) / 100 || 0
  }

  // Recent members (filtered by chapter for non-super admins)
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
  // Admins who can manage other admins (not national_admin or city_admin)
  const canManageAdmins = ['super_admin', 'state_admin', 'county_admin'].includes(currentAdmin.role)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl text-gray-900">Admin Dashboard</h1>
        {!hasFullDataAccess && currentAdmin.chapters && (
          <p className="text-gray-600 mt-1">
            Managing: {currentAdmin.chapters.name} and sub-chapters
          </p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="card p-4 sm:p-6">
          <div className="text-xs sm:text-sm text-gray-500">Total Members</div>
          <div className="text-2xl sm:text-3xl font-bold text-gray-900">{memberStats.total}</div>
          <div className="text-xs sm:text-sm text-gray-500">{memberStats.active || 0} active</div>
        </div>
        <div className="card p-4 sm:p-6">
          <div className="text-xs sm:text-sm text-gray-500">Pending</div>
          <div className="text-2xl sm:text-3xl font-bold text-yellow-600">{memberStats.pending || 0}</div>
          <div className="text-xs sm:text-sm text-gray-500">Awaiting review</div>
        </div>
        <div className="card p-4 sm:p-6">
          <div className="text-xs sm:text-sm text-gray-500">Chapters</div>
          <div className="text-2xl sm:text-3xl font-bold text-labor-red">{chapterStats.total}</div>
          <div className="text-xs sm:text-sm text-gray-500 truncate">
            {chapterStats.state || 0}s {chapterStats.county || 0}c {chapterStats.city || 0}ci
          </div>
        </div>
        <div className="card p-4 sm:p-6">
          <div className="text-xs sm:text-sm text-gray-500">Total Revenue</div>
          <div className="text-2xl sm:text-3xl font-bold text-green-600">${totalRevenue.toLocaleString()}</div>
          <div className="text-xs sm:text-sm text-gray-500">From contributions</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
        {/* Recent Members */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl">Recent Members</h2>
            <Link href="/members" className="text-labor-red text-sm hover:underline">View All</Link>
          </div>
          {recentMembers?.length > 0 ? (
            <div className="space-y-3">
              {recentMembers.map(member => (
                <div key={member.id} className="flex justify-between items-center border-b pb-3 last:border-0">
                  <div>
                    <div className="font-medium">
                      {member.first_name} {member.last_name}
                    </div>
                    <div className="text-sm text-gray-500">{member.email}</div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(member.joined_date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No members yet.</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-xl mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/admin/import" className="block w-full btn-primary text-center">
              Import Members
            </Link>
            {isSuperAdmin && (
              <Link href="/admin/chapters/new" className="block w-full btn-secondary text-center">
                Create New Chapter
              </Link>
            )}
            <Link href="/chapters" className="block w-full btn-secondary text-center">
              {isSuperAdmin ? 'Manage Chapters' : 'View Chapters'}
            </Link>
            <Link href="/members" className="block w-full btn-secondary text-center">
              {hasFullDataAccess ? 'View All Members' : 'View Members'}
            </Link>
            <Link href="/members?status=pending" className="block w-full btn-secondary text-center">
              Review Pending Members
            </Link>
            <Link href="/admin/events" className="block w-full btn-secondary text-center">
              Manage Events
            </Link>
            <Link href="/admin/groups" className="block w-full btn-secondary text-center">
              Manage Groups
            </Link>
            <Link href="/admin/email" className="block w-full btn-secondary text-center">
              Send Email to Members
            </Link>
            {isSuperAdmin && (
              <Link href="/admin/email-templates" className="block w-full btn-secondary text-center">
                Email Templates
              </Link>
            )}
            {hasFullDataAccess && (
              <Link href="/admin/initiatives" className="block w-full btn-secondary text-center">
                Manage Initiatives
              </Link>
            )}
            <Link href="/admin/files" className="block w-full btn-secondary text-center">
              File Manager
            </Link>
            {canManageAdmins && (
              <Link href="/admin/admins" className="block w-full btn-secondary text-center">
                Manage Administrators
              </Link>
            )}
            {isSuperAdmin && (
              <Link href="/admin/sync-payments" className="block w-full btn-secondary text-center">
                Sync Stripe Payments
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
