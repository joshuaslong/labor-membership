import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { getEffectiveChapterScope, resolveChapterIds } from '@/lib/chapterScope'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 50

export default async function AdminVolunteersPage({ searchParams: searchParamsPromise }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const searchParams = await searchParamsPromise
  const supabase = await createClient()
  const adminClient = createAdminClient()

  const page = Math.max(1, parseInt(searchParams?.page) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const scope = await getEffectiveChapterScope(teamMember)
  const chapterIds = await resolveChapterIds(scope, supabase)

  // Query members who want to volunteer
  let query = adminClient
    .from('members')
    .select(`
      id,
      first_name,
      last_name,
      email,
      volunteer_skills,
      volunteer_interests,
      chapter_id,
      created_at,
      chapters (id, name)
    `, { count: 'exact' })
    .eq('wants_to_volunteer', true)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(from, to)

  // Apply chapter scope
  if (chapterIds && chapterIds.length > 0) {
    query = query.in('chapter_id', chapterIds)
  }

  const { data: volunteers, error, count: totalCount } = await query

  if (error) {
    throw new Error(`Failed to fetch volunteers: ${error.message}`)
  }

  // Get application counts for each volunteer
  const volunteerIds = (volunteers || []).map(v => v.id)
  let appCounts = {}
  if (volunteerIds.length > 0) {
    const { data: apps } = await adminClient
      .from('volunteer_applications')
      .select('member_id, status')
      .in('member_id', volunteerIds)

    appCounts = (apps || []).reduce((acc, app) => {
      if (!acc[app.member_id]) acc[app.member_id] = { total: 0, approved: 0 }
      acc[app.member_id].total++
      if (app.status === 'approved') acc[app.member_id].approved++
      return acc
    }, {})
  }

  // Client-side search filter
  let filtered = volunteers || []
  if (searchParams?.search) {
    const term = searchParams.search.toLowerCase()
    filtered = filtered.filter(v => {
      const name = `${v.first_name} ${v.last_name}`.toLowerCase()
      const email = v.email?.toLowerCase() || ''
      return name.includes(term) || email.includes(term)
    })
  }

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE)

  function pageUrl(p) {
    const params = new URLSearchParams()
    if (searchParams?.search) params.set('search', searchParams.search)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `/workspace/admin/volunteers?${qs}` : '/workspace/admin/volunteers'
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit'
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Volunteers</h1>
          {totalCount != null && (
            <p className="text-xs text-gray-500 mt-0.5">
              {totalCount} member{totalCount !== 1 ? 's' : ''} opted in to volunteering
            </p>
          )}
        </div>
      </div>

      {/* Volunteer List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded p-12 text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <p className="text-sm text-gray-500">No members have opted into volunteering yet.</p>
          <p className="text-xs text-gray-400 mt-1">Members can opt in from their profile settings.</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded overflow-hidden">
          <table className="min-w-full divide-y divide-stone-200" aria-label="Volunteer members list">
            <caption className="sr-only">Members who opted into volunteering</caption>
            <thead className="bg-stone-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Chapter</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Skills</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Interests</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Applications</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden sm:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map(vol => {
                const counts = appCounts[vol.id] || { total: 0, approved: 0 }
                return (
                  <tr key={vol.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {vol.first_name} {vol.last_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {vol.email}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">
                      {vol.chapters?.name || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell max-w-48">
                      {vol.volunteer_skills ? (
                        <span className="truncate block" title={vol.volunteer_skills}>
                          {vol.volunteer_skills}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell max-w-48">
                      {vol.volunteer_interests ? (
                        <span className="truncate block" title={vol.volunteer_interests}>
                          {vol.volunteer_interests}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-gray-900">{counts.total}</span>
                      {counts.approved > 0 && (
                        <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700">
                          {counts.approved} approved
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 tabular-nums hidden sm:table-cell">
                      {formatDate(vol.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          {page > 1 ? (
            <Link
              href={pageUrl(page - 1)}
              className="px-3 py-1.5 border border-stone-200 rounded text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Previous
            </Link>
          ) : (
            <span className="px-3 py-1.5 border border-stone-100 rounded text-gray-300">Previous</span>
          )}
          <span className="text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link
              href={pageUrl(page + 1)}
              className="px-3 py-1.5 border border-stone-200 rounded text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Next
            </Link>
          ) : (
            <span className="px-3 py-1.5 border border-stone-100 rounded text-gray-300">Next</span>
          )}
        </div>
      )}
    </div>
  )
}
