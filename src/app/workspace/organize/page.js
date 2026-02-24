import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { getEffectiveChapterScope, resolveChapterIds, applyChapterFilter } from '@/lib/chapterScope'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import VolunteerRowActions from '@/components/VolunteerRowActions'

const PAGE_SIZE = 50

export default async function VolunteersPage({ searchParams: searchParamsPromise }) {
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

  function applyFilters(q) {
    q = applyChapterFilter(q, chapterIds)
    if (searchParams?.search) {
      q = q.ilike('title', `%${searchParams.search}%`)
    }
    if (searchParams?.status) {
      q = q.eq('status', searchParams.status)
    } else {
      q = q.neq('status', 'cancelled')
    }
    if (searchParams?.type) {
      q = q.eq('opportunity_type', searchParams.type)
    }
    return q
  }

  // Get total count
  let countQuery = adminClient
    .from('volunteer_opportunities')
    .select('id', { count: 'exact', head: true })
  countQuery = applyFilters(countQuery)
  const { count: totalCount } = await countQuery

  // Get page of data
  let query = adminClient
    .from('volunteer_opportunities')
    .select(`
      id,
      title,
      description,
      opportunity_type,
      status,
      event_date,
      skills_needed,
      spots_available,
      deadline,
      created_at,
      chapter_id,
      chapters (name)
    `)
    .order('created_at', { ascending: false })
    .range(from, to)

  query = applyFilters(query)
  const { data: opportunities, error } = await query

  if (error) {
    console.error('Error fetching volunteer opportunities:', error)
    throw new Error('Failed to load volunteer opportunities')
  }

  // Get application counts
  const oppIds = (opportunities || []).map(o => o.id)
  let appCounts = {}
  if (oppIds.length > 0) {
    const { data: apps } = await adminClient
      .from('volunteer_applications')
      .select('opportunity_id, status')
      .in('opportunity_id', oppIds)

    appCounts = (apps || []).reduce((acc, app) => {
      if (!acc[app.opportunity_id]) acc[app.opportunity_id] = { pending: 0, approved: 0, total: 0 }
      acc[app.opportunity_id].total++
      if (app.status === 'pending') acc[app.opportunity_id].pending++
      if (app.status === 'approved') acc[app.opportunity_id].approved++
      return acc
    }, {})
  }

  // Page title
  const statusLabels = {
    draft: 'Draft Opportunities',
    published: 'Published Opportunities',
    filled: 'Filled Opportunities',
    cancelled: 'Cancelled Opportunities',
  }
  const typeLabels = {
    one_time: 'One-time Opportunities',
    ongoing: 'Ongoing Opportunities',
  }
  const pageTitle = searchParams?.status
    ? statusLabels[searchParams.status] || 'Opportunities'
    : searchParams?.type
      ? typeLabels[searchParams.type] || 'Opportunities'
      : 'All Opportunities'

  const statusBadge = {
    draft: 'bg-amber-50 text-amber-700',
    published: 'bg-green-50 text-green-700',
    filled: 'bg-blue-50 text-blue-700',
    cancelled: 'bg-red-50 text-red-700',
  }

  const typeBadge = {
    one_time: 'bg-purple-50 text-purple-700',
    ongoing: 'bg-teal-50 text-teal-700',
  }

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE)
  const hasNext = page < totalPages
  const hasPrev = page > 1

  function pageUrl(p) {
    const params = new URLSearchParams()
    if (searchParams?.search) params.set('search', searchParams.search)
    if (searchParams?.status) params.set('status', searchParams.status)
    if (searchParams?.type) params.set('type', searchParams.type)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `/workspace/organize?${qs}` : '/workspace/organize'
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{pageTitle}</h1>
        {totalCount != null && (
          <span className="text-xs text-gray-400 tabular-nums">
            {totalCount} opportunit{totalCount !== 1 ? 'ies' : 'y'}
          </span>
        )}
      </div>

      <div className="bg-white border border-stone-200 rounded overflow-hidden">
        {!opportunities || opportunities.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            <p>No volunteer opportunities found.</p>
          </div>
        ) : (
          <>
          {/* Mobile card view */}
          <div className="md:hidden divide-y divide-stone-100">
            {opportunities.map(opp => {
              const counts = appCounts[opp.id] || { pending: 0, approved: 0, total: 0 }
              return (
                <Link key={opp.id} href={`/workspace/organize/${opp.id}`} className="block px-4 py-3 hover:bg-stone-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{opp.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {opp.opportunity_type === 'one_time' ? 'One-time' : 'Ongoing'}
                        {opp.event_date && ` · ${formatDate(opp.event_date)}`}
                      </p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge[opp.status] || 'bg-gray-50 text-gray-700'}`}>
                      {opp.status}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
                    {opp.chapters?.name && <span>{opp.chapters.name}</span>}
                    <span>{counts.total} application{counts.total !== 1 ? 's' : ''}</span>
                    {counts.pending > 0 && <span className="text-amber-600">{counts.pending} pending</span>}
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Desktop table */}
          <table className="hidden md:table min-w-full divide-y divide-stone-200" aria-label="Volunteer opportunities list">
            <caption className="sr-only">List of volunteer opportunities</caption>
            <thead className="bg-stone-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Opportunity</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Chapter</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Applications</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {opportunities.map(opp => {
                const counts = appCounts[opp.id] || { pending: 0, approved: 0, total: 0 }
                return (
                  <tr key={opp.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/workspace/organize/${opp.id}`} className="text-gray-900 hover:text-labor-red font-medium">
                        {opp.title}
                      </Link>
                      {(opp.skills_needed || []).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {opp.skills_needed.slice(0, 3).map(skill => (
                            <span key={skill} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                              {skill}
                            </span>
                          ))}
                          {opp.skills_needed.length > 3 && (
                            <span className="text-[10px] text-gray-400">+{opp.skills_needed.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeBadge[opp.opportunity_type] || 'bg-gray-50 text-gray-700'}`}>
                        {opp.opportunity_type === 'one_time' ? 'One-time' : 'Ongoing'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                      {opp.opportunity_type === 'one_time' && opp.event_date
                        ? formatDate(opp.event_date)
                        : <span className="text-gray-400">—</span>}
                      {opp.deadline && (
                        <div className="text-xs text-gray-400">Deadline: {formatDate(opp.deadline)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{opp.chapters?.name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-gray-900">{counts.total}</span>
                      {counts.pending > 0 && (
                        <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700">
                          {counts.pending} pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge[opp.status] || 'bg-gray-50 text-gray-700'}`}>
                        {opp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <VolunteerRowActions opportunityId={opp.id} opportunityTitle={opp.title} opportunityStatus={opp.status} />
                    </td>
                  </tr>
                )
              })}
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
