import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'

export const dynamic = 'force-dynamic'

const LEVEL_COLORS = {
  national: 'text-labor-red bg-red-50 border border-red-200',
  state: 'text-blue-700 bg-blue-50 border border-blue-200',
  county: 'text-green-700 bg-green-50 border border-green-200',
  city: 'text-purple-700 bg-purple-50 border border-purple-200',
}
const LEVEL_LABELS = {
  national: 'National',
  state: 'State',
  county: 'County',
  city: 'City',
}

export default async function WorkspaceChapterDetailPage({ params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const { id } = await params
  const supabase = createAdminClient()

  const { data: chapter } = await supabase
    .from('chapters')
    .select('*')
    .eq('id', id)
    .single()

  if (!chapter) notFound()

  // Get parent chapter
  let parent = null
  if (chapter.parent_id) {
    const { data } = await supabase
      .from('chapters')
      .select('id, name, level')
      .eq('id', chapter.parent_id)
      .single()
    parent = data
  }

  // Get child chapters
  const { data: children } = await supabase
    .from('chapters')
    .select('id, name, level')
    .eq('parent_id', id)
    .order('name')

  // Get member count for this chapter
  const { count: memberCount } = await supabase
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('chapter_id', id)
    .eq('status', 'active')

  // Get recent members
  const { data: recentMembers } = await supabase
    .from('members')
    .select('id, first_name, last_name, email, status, joined_date')
    .eq('chapter_id', id)
    .order('joined_date', { ascending: false })
    .limit(10)

  // Get upcoming events for this chapter
  const now = new Date().toISOString().split('T')[0]
  const { data: events } = await supabase
    .from('events')
    .select('id, title, start_date, start_time, location_name, status')
    .eq('chapter_id', id)
    .gte('start_date', now)
    .order('start_date', { ascending: true })
    .limit(5)

  const hasChildren = children && children.length > 0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link href="/workspace/chapters" className="text-xs text-gray-500 hover:text-gray-700">
          Chapters
        </Link>
        {parent && (
          <>
            <span className="text-xs text-gray-400 mx-1">/</span>
            <Link href={`/workspace/chapters/${parent.id}`} className="text-xs text-gray-500 hover:text-gray-700">
              {parent.name}
            </Link>
          </>
        )}
        <span className="text-xs text-gray-400 mx-1">/</span>
        <span className="text-xs text-gray-900">{chapter.name}</span>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[chapter.level]}`}>
          {LEVEL_LABELS[chapter.level]}
        </span>
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">{chapter.name}</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-stone-200 rounded px-4 py-3">
              <div className="text-2xl font-semibold text-gray-900 tabular-nums">{memberCount || 0}</div>
              <div className="text-xs text-gray-500">Active Members</div>
            </div>
            <div className="bg-white border border-stone-200 rounded px-4 py-3">
              <div className="text-2xl font-semibold text-gray-900 tabular-nums">{children?.length || 0}</div>
              <div className="text-xs text-gray-500">Sub-Chapters</div>
            </div>
            <div className="bg-white border border-stone-200 rounded px-4 py-3">
              <div className="text-2xl font-semibold text-gray-900 tabular-nums">{events?.length || 0}</div>
              <div className="text-xs text-gray-500">Upcoming Events</div>
            </div>
          </div>

          {/* Members */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Members</h2>
              <Link href={`/workspace/members?chapter=${id}`} className="text-xs text-gray-500 hover:text-gray-700">View all</Link>
            </div>
            {recentMembers && recentMembers.length > 0 ? (
              <ul className="divide-y divide-stone-100">
                {recentMembers.map(member => (
                  <li key={member.id}>
                    <Link href={`/workspace/members/${member.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-stone-50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{member.first_name} {member.last_name}</p>
                        <p className="text-xs text-gray-500 truncate">{member.email}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4 shrink-0">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          member.status === 'active' ? 'bg-green-50 text-green-700' :
                          member.status === 'pending' ? 'bg-amber-50 text-amber-700' :
                          'bg-gray-50 text-gray-700'
                        }`}>
                          {member.status}
                        </span>
                        <span className="text-xs text-gray-400 tabular-nums">
                          {new Date(member.joined_date).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-gray-500">No members in this chapter</div>
            )}
          </div>

          {/* Upcoming Events */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Upcoming Events</h2>
              <Link href={`/workspace/events?chapter=${id}`} className="text-xs text-gray-500 hover:text-gray-700">View all</Link>
            </div>
            {events && events.length > 0 ? (
              <ul className="divide-y divide-stone-100">
                {events.map(event => (
                  <li key={event.id}>
                    <Link href={`/workspace/events/${event.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-stone-50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{event.title}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          {event.location_name && ` \u00b7 ${event.location_name}`}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium shrink-0 ml-4 ${
                        event.status === 'published' ? 'bg-green-50 text-green-700' :
                        event.status === 'draft' ? 'bg-gray-50 text-gray-600' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {event.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-gray-500">No upcoming events</div>
            )}
          </div>
        </div>

        {/* Sidebar - 1/3 */}
        <div className="space-y-6">
          {/* Chapter Info */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Details</h2>
            </div>
            <div className="px-4 py-3 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Level</span>
                <span className="text-gray-900">{LEVEL_LABELS[chapter.level]}</span>
              </div>
              {parent && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Parent</span>
                  <Link href={`/workspace/chapters/${parent.id}`} className="text-gray-900 hover:text-labor-red">{parent.name}</Link>
                </div>
              )}
              {chapter.state_code && (
                <div className="flex justify-between">
                  <span className="text-gray-500">State</span>
                  <span className="text-gray-900">{chapter.state_code}</span>
                </div>
              )}
              {chapter.contact_email && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Contact</span>
                  <span className="text-gray-900">{chapter.contact_email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Sub-Chapters */}
          {hasChildren && (
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Sub-Chapters ({children.length})
                </h2>
              </div>
              <ul className="divide-y divide-stone-100">
                {children.map(child => (
                  <li key={child.id}>
                    <Link href={`/workspace/chapters/${child.id}`} className="flex items-center gap-2 px-4 py-2.5 hover:bg-stone-50">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[child.level]}`}>
                        {LEVEL_LABELS[child.level]?.charAt(0)}
                      </span>
                      <span className="text-sm text-gray-900 truncate">{child.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
