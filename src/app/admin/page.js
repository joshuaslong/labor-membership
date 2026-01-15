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

  const { data: adminUser } = await authClient
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!adminUser) {
    redirect('/dashboard')
  }

  const supabase = createAdminClient()

  // Get member stats
  const { data: members } = await supabase.from('members').select('status')
  const memberStats = members?.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1
    acc.total = (acc.total || 0) + 1
    return acc
  }, { total: 0 }) || { total: 0 }

  // Get chapter counts by level
  const { data: chapters } = await supabase.from('chapters').select('level')
  const chapterStats = chapters?.reduce((acc, c) => {
    acc[c.level] = (acc[c.level] || 0) + 1
    acc.total = (acc.total || 0) + 1
    return acc
  }, { total: 0 }) || { total: 0 }

  // Get payment totals
  const { data: payments } = await supabase
    .from('payments')
    .select('amount_cents')
    .eq('status', 'succeeded')

  const totalRevenue = payments?.reduce((sum, p) => sum + p.amount_cents, 0) / 100 || 0

  // Recent members
  const { data: recentMembers } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, status, joined_date')
    .order('joined_date', { ascending: false })
    .limit(5)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8">Admin Dashboard</h1>

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
          <div className="text-xs sm:text-sm text-gray-500">From dues</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
        {/* Recent Members */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Recent Members</h2>
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
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/admin/import" className="block w-full btn-primary text-center">
              Import Members
            </Link>
            <Link href="/admin/chapters/new" className="block w-full btn-secondary text-center">
              Create New Chapter
            </Link>
            <Link href="/chapters" className="block w-full btn-secondary text-center">
              Manage Chapters
            </Link>
            <Link href="/members" className="block w-full btn-secondary text-center">
              View All Members
            </Link>
            <Link href="/members?status=pending" className="block w-full btn-secondary text-center">
              Review Pending Members
            </Link>
            <Link href="/admin/admins" className="block w-full btn-secondary text-center">
              Manage Administrators
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
