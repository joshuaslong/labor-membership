import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { getEffectiveChapterScope, resolveChapterIds, applyChapterFilter } from '@/lib/chapterScope'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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
  membership_coordinator: 'text-teal-700 bg-teal-50 border-teal-200',
  event_coordinator: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  communications_lead: 'text-pink-700 bg-pink-50 border-pink-200',
  content_creator: 'text-violet-700 bg-violet-50 border-violet-200',
  volunteer_manager: 'text-orange-700 bg-orange-50 border-orange-200',
  data_manager: 'text-cyan-700 bg-cyan-50 border-cyan-200',
}

const PAGE_SIZE = 50

export default async function TeamPage({ searchParams: searchParamsPromise }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const searchParams = await searchParamsPromise
  const supabase = await createClient()

  const page = Math.max(1, parseInt(searchParams?.page) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const scope = await getEffectiveChapterScope(teamMember)
  const chapterIds = await resolveChapterIds(scope, supabase)

  let query = supabase
    .from('team_members')
    .select(`
      id,
      user_id,
      roles,
      active,
      chapter_id,
      created_at,
      member:members(id, first_name, last_name, email),
      chapter:chapters(id, name, level)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  query = applyChapterFilter(query, chapterIds)

  if (searchParams?.role) {
    query = query.contains('roles', [searchParams.role])
  }
  if (searchParams?.active === 'false') {
    query = query.eq('active', false)
  } else {
    query = query.eq('active', true)
  }
  if (searchParams?.search) {
    // We need to search by member name - use a text search approach
    // Unfortunately PostgREST doesn't support filtering on joined fields easily
    // So we'll filter client-side for search
  }

  const { data: members, error, count: totalCount } = await query

  if (error) {
    throw new Error(`Failed to fetch team members: ${error.message}`)
  }

  // Backfill names for team members where member_id is null (migrated from admin_users)
  let enriched = members || []
  const missingNames = enriched.filter(tm => !tm.member && tm.user_id)
  if (missingNames.length > 0) {
    const adminClient = createAdminClient()
    const { data: membersByUser } = await adminClient
      .from('members')
      .select('user_id, id, first_name, last_name, email')
      .in('user_id', missingNames.map(tm => tm.user_id))

    if (membersByUser) {
      const userMap = new Map(membersByUser.map(m => [m.user_id, m]))
      enriched = enriched.map(tm => {
        if (!tm.member && tm.user_id && userMap.has(tm.user_id)) {
          const m = userMap.get(tm.user_id)
          return { ...tm, member: { id: m.id, first_name: m.first_name, last_name: m.last_name, email: m.email } }
        }
        return tm
      })
    }
  }

  // Client-side search filter (for name search across join)
  let filtered = enriched
  if (searchParams?.search) {
    const term = searchParams.search.toLowerCase()
    filtered = filtered.filter(tm => {
      const name = tm.member ? `${tm.member.first_name} ${tm.member.last_name}`.toLowerCase() : ''
      const email = tm.member?.email?.toLowerCase() || ''
      return name.includes(term) || email.includes(term)
    })
  }

  const pageTitle = searchParams?.role
    ? roleLabels[searchParams.role] || 'Team Members'
    : searchParams?.active === 'false'
      ? 'Inactive Team Members'
      : 'Team Members'

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE)

  function pageUrl(p) {
    const params = new URLSearchParams()
    if (searchParams?.role) params.set('role', searchParams.role)
    if (searchParams?.active) params.set('active', searchParams.active)
    if (searchParams?.search) params.set('search', searchParams.search)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `/workspace/admin/team?${qs}` : '/workspace/admin/team'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{pageTitle}</h1>
          {totalCount != null && (
            <p className="text-xs text-gray-500 mt-0.5">
              {totalCount} {totalCount === 1 ? 'member' : 'members'}
            </p>
          )}
        </div>
        <Link
          href="/workspace/admin/team/add"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-labor-red hover:bg-red-700 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Team Member
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <FilterPill href="/workspace/admin/team" label="All" active={!searchParams?.role && searchParams?.active !== 'false'} />
        <FilterPill href="/workspace/admin/team?role=super_admin" label="Super Admin" active={searchParams?.role === 'super_admin'} />
        <FilterPill href="/workspace/admin/team?role=national_admin" label="National" active={searchParams?.role === 'national_admin'} />
        <FilterPill href="/workspace/admin/team?role=state_admin" label="State" active={searchParams?.role === 'state_admin'} />
        <FilterPill href="/workspace/admin/team?role=county_admin" label="County" active={searchParams?.role === 'county_admin'} />
        <FilterPill href="/workspace/admin/team?role=city_admin" label="City" active={searchParams?.role === 'city_admin'} />
        <span className="text-gray-300">|</span>
        <FilterPill href="/workspace/admin/team?active=false" label="Inactive" active={searchParams?.active === 'false'} />
      </div>

      {/* Team List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded p-12 text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
          <p className="text-sm text-gray-500 mb-1">No team members found</p>
          <Link href="/workspace/admin/team/add" className="text-sm text-labor-red hover:underline">
            Add your first team member
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded divide-y divide-stone-100">
          {filtered.map(tm => (
            <Link
              key={tm.id}
              href={`/workspace/admin/team/${tm.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">
                  {tm.member ? `${tm.member.first_name} ${tm.member.last_name}` : 'Unknown User'}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500">{tm.member?.email}</span>
                  {tm.chapter && (
                    <>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{tm.chapter.name}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Role badges */}
              <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                {tm.roles?.map(role => (
                  <span
                    key={role}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${roleBadgeColor[role] || 'text-gray-700 bg-stone-50 border-stone-200'}`}
                  >
                    {roleLabels[role] || role}
                  </span>
                ))}
              </div>

              {/* Date */}
              <div className="text-right flex-shrink-0 w-20">
                <div className="text-xs text-gray-400 tabular-nums">
                  {new Date(tm.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                </div>
              </div>
            </Link>
          ))}
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

function FilterPill({ href, label, active }) {
  return (
    <Link
      href={href}
      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-gray-900 text-white'
          : 'bg-stone-50 text-gray-600 border border-stone-200 hover:bg-stone-100'
      }`}
    >
      {label}
    </Link>
  )
}
