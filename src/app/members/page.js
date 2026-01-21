import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const STATUS_BADGES = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  lapsed: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default async function MembersPage({ searchParams }) {
  const params = await searchParams
  const status = params.status || 'all'
  const search = params.search || ''

  // Get current user and their admin record
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const supabase = createAdminClient()

  // Get current admin's role and chapter (user can have multiple admin records)
  const { data: adminRecordsForUser } = await supabase
    .from('admin_users')
    .select('id, role, chapter_id')
    .eq('user_id', user.id)

  if (!adminRecordsForUser || adminRecordsForUser.length === 0) {
    redirect('/dashboard')
  }

  // Use highest privilege role for determining access
  const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
  const currentAdmin = adminRecordsForUser.reduce((highest, current) => {
    const currentIndex = roleHierarchy.indexOf(current.role)
    const highestIndex = roleHierarchy.indexOf(highest.role)
    return currentIndex < highestIndex ? current : highest
  }, adminRecordsForUser[0])

  // Get chapter IDs this admin can access
  // super_admin and national_admin have access to all data
  let allowedChapterIds = null
  if (!['super_admin', 'national_admin'].includes(currentAdmin.role)) {
    const { data: descendants } = await supabase
      .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })
    allowedChapterIds = descendants?.map(d => d.id) || []
  }

  // Build query with chapter filtering
  let query = supabase
    .from('members')
    .select('*, chapters(name, level)')
    .order('last_name')

  // Apply chapter filter for non-super admins
  if (allowedChapterIds) {
    query = query.in('chapter_id', allowedChapterIds)
  }

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data: members } = await query.limit(100)

  // Get admin records for these members to show admin badges (supports multiple per user)
  const memberUserIds = members?.filter(m => m.user_id).map(m => m.user_id) || []
  let adminRecords = {}
  if (memberUserIds.length > 0) {
    const { data: admins } = await supabase
      .from('admin_users')
      .select('user_id, role, chapters(name)')
      .in('user_id', memberUserIds)
    admins?.forEach(a => {
      if (!adminRecords[a.user_id]) {
        adminRecords[a.user_id] = []
      }
      adminRecords[a.user_id].push({ role: a.role, chapter: a.chapters?.name })
    })
  }

  // Get counts by status (filtered by chapter for non-super admins)
  let countsQuery = supabase.from('members').select('status')
  if (allowedChapterIds) {
    countsQuery = countsQuery.in('chapter_id', allowedChapterIds)
  }
  const { data: allMembers } = await countsQuery

  const counts = allMembers?.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1
    acc.all = (acc.all || 0) + 1
    return acc
  }, { all: 0 }) || { all: 0 }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl text-gray-900">Members</h1>
          <p className="text-gray-600">
            {['super_admin', 'national_admin'].includes(currentAdmin.role)
              ? 'Manage membership across all chapters'
              : 'Manage membership in your chapter jurisdiction'}
          </p>
        </div>
        <Link href="/join" className="btn-primary">Add Member</Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2">
            {['all', 'pending', 'active', 'lapsed', 'cancelled'].map(s => (
              <Link
                key={s}
                href={`/members?status=${s}${search ? `&search=${search}` : ''}`}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  status === s ? 'bg-labor-red text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s] || 0})
              </Link>
            ))}
          </div>
          <form className="flex-1 max-w-md">
            <input
              type="text"
              name="search"
              placeholder="Search by name or email..."
              defaultValue={search}
              className="input-field"
            />
          </form>
        </div>
      </div>

      {/* Members table */}
      {members?.length === 0 ? (
        <div className="card text-center text-gray-500 py-12">No members found.</div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chapter</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members?.map(member => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Link href={`/members/${member.id}`} className="font-medium text-gray-900 hover:text-labor-red">
                        {member.first_name || member.last_name
                          ? `${member.first_name || ''} ${member.last_name || ''}`.trim()
                          : <span className="text-gray-500 italic">{member.email || 'No name'}</span>
                        }
                      </Link>
                      {member.user_id && adminRecords[member.user_id]?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {adminRecords[member.user_id].map((record, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                              {record.role === 'super_admin' ? 'Super' :
                               record.role === 'national_admin' ? 'National' :
                               record.role === 'state_admin' ? 'State' :
                               record.role === 'county_admin' ? 'County' :
                               record.role === 'city_admin' ? 'City' :
                               'Admin'}
                              {record.chapter && !['super_admin', 'national_admin'].includes(record.role) && (
                                <span className="ml-1 opacity-75">({record.chapter})</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{member.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {member.chapters ? (
                      <Link href={`/chapters/${member.chapter_id}`} className="text-labor-red hover:underline">
                        {member.chapters.name}
                      </Link>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGES[member.status]}`}>
                      {member.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {new Date(member.joined_date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
