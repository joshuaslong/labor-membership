import { createClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import SegmentBadge from '@/components/SegmentBadge'

export default async function MembersPage({ searchParams }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const supabase = await createClient()

  // Build query with filters
  let query = supabase
    .from('members')
    .select(`
      id,
      first_name,
      last_name,
      email,
      joined_date,
      chapter_id,
      chapters(name),
      member_segments(segment, auto_applied)
    `)
    .order('joined_date', { ascending: false })
    .limit(50)

  // Filter by segment if specified
  if (searchParams?.segment) {
    query = query.filter('member_segments.segment', 'eq', searchParams.segment)
  }

  // Filter by status if specified
  if (searchParams?.status) {
    query = query.eq('status', searchParams.status)
  }

  const { data: members } = await query

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Members</h1>
      </div>

      <div className="bg-white border border-stone-200 rounded overflow-hidden">
        <table className="min-w-full divide-y divide-stone-200">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Segments</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Chapter</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {members?.map(member => (
              <tr key={member.id} className="hover:bg-stone-50">
                <td className="px-4 py-3 text-sm text-gray-900">
                  {member.first_name} {member.last_name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{member.email}</td>
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
      </div>
    </div>
  )
}
