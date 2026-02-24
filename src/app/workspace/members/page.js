import { createClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { getEffectiveChapterScope, resolveChapterIds, applyChapterFilter } from '@/lib/chapterScope'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SegmentBadge from '@/components/SegmentBadge'
import MembersToolbar from '@/components/MembersToolbar'

const PAGE_SIZE = 50

export default async function MembersPage({ searchParams: searchParamsPromise }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const searchParams = await searchParamsPromise

  const supabase = await createClient()
  const page = Math.max(1, parseInt(searchParams?.page) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const scope = await getEffectiveChapterScope(teamMember)
  const chapterIds = await resolveChapterIds(scope, supabase)

  // Apply shared filters (chapter scope, search, segment, status) — synchronous
  function applyFilters(q) {
    q = applyChapterFilter(q, chapterIds)
    if (searchParams?.search) {
      const term = `%${searchParams.search}%`
      q = q.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`)
    }
    if (searchParams?.segment) {
      q = q.filter('member_segments.segment', 'eq', searchParams.segment)
    }
    if (searchParams?.status) {
      q = q.eq('status', searchParams.status)
    }
    return q
  }

  // Get total count — only join member_segments when segment filter is active
  let countQuery = searchParams?.segment
    ? supabase.from('members').select('id, member_segments(segment)', { count: 'exact', head: true })
    : supabase.from('members').select('id', { count: 'exact', head: true })
  countQuery = applyFilters(countQuery)
  const { count: totalCount } = await countQuery

  // Get page of data
  let query = supabase
    .from('members')
    .select(`
      id,
      first_name,
      last_name,
      email,
      status,
      joined_date,
      chapter_id,
      chapters(name),
      member_segments(segment, auto_applied)
    `)
    .order('joined_date', { ascending: false })
    .range(from, to)

  query = applyFilters(query)

  const { data: members, error } = await query

  if (error) {
    console.error('Error fetching members:', error)
    throw new Error('Failed to load members')
  }

  // Contextual page title
  const segmentLabels = {
    donor: 'Donors',
    volunteer: 'Volunteers',
    event_attendee: 'Event Attendees',
    organizer: 'Organizers',
    new_member: 'New Members',
  }
  const statusLabels = {
    pending: 'Pending Approval',
    active: 'Active Members',
    lapsed: 'Lapsed Members',
    cancelled: 'Cancelled Members',
  }
  const pageTitle = searchParams?.segment
    ? segmentLabels[searchParams.segment] || 'Members'
    : searchParams?.status
      ? statusLabels[searchParams.status] || 'Members'
      : 'All Members'

  const statusBadge = {
    active: 'bg-green-50 text-green-700',
    pending: 'bg-amber-50 text-amber-700',
    lapsed: 'bg-orange-50 text-orange-700',
    cancelled: 'bg-red-50 text-red-700',
  }

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE)
  const hasNext = page < totalPages
  const hasPrev = page > 1

  // Build pagination URL preserving existing params
  function pageUrl(p) {
    const params = new URLSearchParams()
    if (searchParams?.search) params.set('search', searchParams.search)
    if (searchParams?.segment) params.set('segment', searchParams.segment)
    if (searchParams?.status) params.set('status', searchParams.status)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `/workspace/members?${qs}` : '/workspace/members'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{pageTitle}</h1>
        {totalCount != null && (
          <span className="text-xs text-gray-400 tabular-nums">
            {totalCount} member{totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="mb-4">
        <MembersToolbar />
      </div>

      <div className="bg-white border border-stone-200 rounded overflow-hidden">
        {!members || members.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            <p>No members found.</p>
          </div>
        ) : (
          <>
          {/* Mobile card view */}
          <div className="md:hidden divide-y divide-stone-100">
            {members.map(member => (
              <Link key={member.id} href={`/workspace/members/${member.id}`} className="block px-4 py-3 hover:bg-stone-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">{member.first_name} {member.last_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{member.email}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge[member.status] || 'bg-gray-50 text-gray-700'}`}>
                    {member.status}
                  </span>
                </div>
                {member.member_segments?.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {member.member_segments.map((seg) => (
                      <SegmentBadge key={seg.segment} segment={seg.segment} />
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <table className="hidden md:table min-w-full divide-y divide-stone-200" aria-label="Members list">
            <caption className="sr-only">List of members with their details</caption>
            <thead className="bg-stone-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Segments</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Chapter</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {members.map(member => (
                <tr key={member.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 text-sm">
                    <Link href={`/workspace/members/${member.id}`} className="text-gray-900 hover:text-labor-red">
                      {member.first_name} {member.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{member.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge[member.status] || 'bg-gray-50 text-gray-700'}`}>
                      {member.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {member.member_segments?.map((seg) => (
                        <SegmentBadge key={seg.segment} segment={seg.segment} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{member.chapters?.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                    {new Date(member.joined_date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-gray-500 tabular-nums">
            {from + 1}–{Math.min(from + PAGE_SIZE, totalCount)} of {totalCount}
          </div>
          <div className="flex items-center gap-2">
            {hasPrev ? (
              <Link
                href={pageUrl(page - 1)}
                className="px-3 py-1.5 text-sm border border-stone-200 rounded bg-white text-gray-700 hover:bg-stone-50"
              >
                Previous
              </Link>
            ) : (
              <span className="px-3 py-1.5 text-sm border border-stone-100 rounded bg-stone-50 text-gray-300">
                Previous
              </span>
            )}
            <span className="text-xs text-gray-500 tabular-nums">
              Page {page} of {totalPages}
            </span>
            {hasNext ? (
              <Link
                href={pageUrl(page + 1)}
                className="px-3 py-1.5 text-sm border border-stone-200 rounded bg-white text-gray-700 hover:bg-stone-50"
              >
                Next
              </Link>
            ) : (
              <span className="px-3 py-1.5 text-sm border border-stone-100 rounded bg-stone-50 text-gray-300">
                Next
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
