import { createClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { getChapterScope } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SegmentBadge from '@/components/SegmentBadge'
import MembersToolbar from '@/components/MembersToolbar'

export default async function MembersPage({ searchParams: searchParamsPromise }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const searchParams = await searchParamsPromise

  const supabase = await createClient()

  // Build query with filters
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
    .limit(50)

  // Apply chapter scope filtering
  const scope = getChapterScope(teamMember.roles, teamMember.chapter_id)
  if (scope && scope.chapterId) {
    query = query.eq('chapter_id', scope.chapterId)
  }

  // Search by name or email
  if (searchParams?.search) {
    const term = `%${searchParams.search}%`
    query = query.or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`)
  }

  // Filter by segment if specified
  if (searchParams?.segment) {
    query = query.filter('member_segments.segment', 'eq', searchParams.segment)
  }

  // Filter by status if specified
  if (searchParams?.status) {
    query = query.eq('status', searchParams.status)
  }

  const { data: members, error } = await query

  // Handle database errors
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{pageTitle}</h1>
        {members && <span className="text-xs text-gray-400 tabular-nums">{members.length} result{members.length !== 1 ? 's' : ''}</span>}
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
          <table className="min-w-full divide-y divide-stone-200" aria-label="Members list">
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
                    <Link href={`/members/${member.id}`} className="text-gray-900 hover:text-labor-red">
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
        )}
      </div>
    </div>
  )
}
