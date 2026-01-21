import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const LEVEL_COLORS = {
  national: 'bg-labor-red',
  state: 'bg-blue-600',
  county: 'bg-green-600',
  city: 'bg-purple-600',
}
const LEVEL_LABELS = {
  national: 'National',
  state: 'State',
  county: 'County',
  city: 'City',
}

function formatEventDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatEventTime(timeStr) {
  if (!timeStr) return null
  const [hours, minutes] = timeStr.split(':')
  const date = new Date()
  date.setHours(parseInt(hours), parseInt(minutes))
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export default async function ChapterDetailPage({ params }) {
  const { id } = await params
  const supabase = createAdminClient()
  const supabaseAuth = await createClient()

  // Check if current user is an admin and if they're a member of this chapter
  const { data: { user } } = await supabaseAuth.auth.getUser()
  let isAdmin = false
  let isMember = false
  let isPrimaryChapter = false
  let memberId = null

  if (user) {
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single()
    isAdmin = !!adminUser

    // Check if user is a member of this chapter
    const { data: memberRecord } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (memberRecord) {
      memberId = memberRecord.id
      const { data: memberChapter } = await supabase
        .from('member_chapters')
        .select('is_primary')
        .eq('member_id', memberRecord.id)
        .eq('chapter_id', id)
        .single()

      if (memberChapter) {
        isMember = true
        isPrimaryChapter = memberChapter.is_primary
      }
    }
  }

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

  // Get all descendant chapter IDs to include their events too
  const { data: allChapterIds } = await supabase
    .rpc('get_chapter_descendants', { chapter_uuid: id })

  const chapterIdsForEvents = [id, ...(allChapterIds?.map(c => c.id) || [])]

  // Fetch upcoming events for this chapter and all descendant chapters
  const now = new Date().toISOString().split('T')[0]
  const { data: events } = await supabase
    .from('events')
    .select('id, title, start_date, start_time, end_time, location_name, description, chapter_id, chapters(name)')
    .in('chapter_id', chapterIdsForEvents)
    .eq('status', 'published')
    .gte('start_date', now)
    .order('start_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(5)

  // Get RSVP counts for events
  let eventRsvpCounts = {}
  let userRsvps = {}
  if (events && events.length > 0) {
    const eventIds = events.map(e => e.id)

    const { data: rsvpCounts } = await supabase
      .from('event_rsvps')
      .select('event_id, status')
      .in('event_id', eventIds)

    if (rsvpCounts) {
      rsvpCounts.forEach(rsvp => {
        if (rsvp.status === 'attending') {
          eventRsvpCounts[rsvp.event_id] = (eventRsvpCounts[rsvp.event_id] || 0) + 1
        }
      })
    }

    // Get user's RSVPs if logged in
    if (memberId) {
      const { data: memberRsvps } = await supabase
        .from('event_rsvps')
        .select('event_id, status')
        .eq('member_id', memberId)
        .in('event_id', eventIds)

      if (memberRsvps) {
        memberRsvps.forEach(rsvp => {
          userRsvps[rsvp.event_id] = rsvp.status
        })
      }
    }
  }

  // Only fetch member counts and member list if admin
  let totalMemberCount = 0
  let directMembers = []

  if (isAdmin) {
    // Get total member count using member_chapters junction table
    const { data: allChapterIds } = await supabase
      .rpc('get_chapter_descendants', { chapter_uuid: id })

    if (allChapterIds) {
      const descendantIds = allChapterIds.map(c => c.id)
      const { count } = await supabase
        .from('member_chapters')
        .select('member_id', { count: 'exact', head: true })
        .eq('chapter_id', id)
      totalMemberCount = count || 0
    }

    // Also count members who may only have chapter_id set but not member_chapters
    if (allChapterIds) {
      const descendantIds = allChapterIds.map(c => c.id)
      const { data: membersWithoutMC } = await supabase
        .from('members')
        .select('id')
        .in('chapter_id', descendantIds)
        .eq('status', 'active')

      const { data: memberChapterIds } = await supabase
        .from('member_chapters')
        .select('member_id')
        .eq('chapter_id', id)

      const mcMemberIds = new Set(memberChapterIds?.map(mc => mc.member_id) || [])
      const additionalMembers = membersWithoutMC?.filter(m => !mcMemberIds.has(m.id)).length || 0
      totalMemberCount += additionalMembers
    }

    // Fetch direct members list
    const { data: members } = await supabase
      .from('members')
      .select('*')
      .eq('chapter_id', id)
      .eq('status', 'active')
      .order('last_name')
    directMembers = members || []
  }

  // Group children by level for better organization when there are many
  const childrenByLevel = {}
  if (children && children.length > 0) {
    children.forEach(child => {
      if (!childrenByLevel[child.level]) {
        childrenByLevel[child.level] = []
      }
      childrenByLevel[child.level].push(child)
    })
  }

  const hasEvents = events && events.length > 0
  const hasChildren = children && children.length > 0
  const manyChildren = children && children.length > 8

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link href="/chapters" className="text-gray-500 hover:text-gray-700 text-sm mb-4 inline-block">
        ← Back to Chapters
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-3 py-1 rounded text-white text-sm ${LEVEL_COLORS[chapter.level]}`}>
              {LEVEL_LABELS[chapter.level] || chapter.level}
            </span>
            <h1 className="text-3xl text-gray-900">{chapter.name}</h1>
          </div>
          {parent && (
            <p className="text-gray-600">
              Part of <Link href={`/chapters/${parent.id}`} className="text-labor-red hover:underline">{parent.name}</Link>
            </p>
          )}
        </div>
        {isMember ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">
              {isPrimaryChapter ? 'Your Chapter' : 'Member'}
            </span>
          </div>
        ) : (
          <Link href={`/join?chapter=${id}`} className="btn-primary whitespace-nowrap">
            Join This Chapter
          </Link>
        )}
      </div>

      {/* Admin Stats */}
      {isAdmin && (
        <div className="grid gap-4 mb-8 grid-cols-2 md:grid-cols-4">
          <div className="card text-center py-4">
            <div className="text-2xl font-bold text-labor-red">{directMembers?.length || 0}</div>
            <div className="text-sm text-gray-600">Direct Members</div>
          </div>
          <div className="card text-center py-4">
            <div className="text-2xl font-bold text-gray-900">{totalMemberCount}</div>
            <div className="text-sm text-gray-600">Total Members</div>
          </div>
          <div className="card text-center py-4">
            <div className="text-2xl font-bold text-gray-900">{children?.length || 0}</div>
            <div className="text-sm text-gray-600">Sub-Chapters</div>
          </div>
          <div className="card text-center py-4">
            <div className="text-2xl font-bold text-gray-900">{events?.length || 0}</div>
            <div className="text-sm text-gray-600">Upcoming Events</div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column - Events & Sub-Chapters */}
        <div className="lg:col-span-2 space-y-8">
          {/* Upcoming Events */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Upcoming Events</h2>
              {hasEvents && (
                <Link href={`/events?chapter=${id}`} className="text-sm text-labor-red hover:underline">
                  View all
                </Link>
              )}
            </div>

            {hasEvents ? (
              <div className="space-y-4">
                {events.map(event => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {formatEventDate(event.start_date)}
                          </span>
                          {event.start_time && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {formatEventTime(event.start_time)}
                            </span>
                          )}
                          {event.location_name && (
                            <span className="flex items-center gap-1 truncate">
                              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="truncate">{event.location_name}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-sm text-gray-500">
                          {eventRsvpCounts[event.id] || 0} going
                        </span>
                        {userRsvps[event.id] === 'attending' && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                            You're going
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p>No upcoming events scheduled</p>
                <p className="text-sm mt-1">Check back soon for new events!</p>
              </div>
            )}
          </div>

          {/* Sub-Chapters */}
          {hasChildren && (
            <div className="card">
              <h2 className="text-xl font-bold mb-4">
                Sub-Chapters ({children.length})
              </h2>

              {manyChildren ? (
                // Grouped by level when there are many sub-chapters
                <div className="space-y-6">
                  {Object.entries(childrenByLevel).map(([level, levelChildren]) => (
                    <div key={level}>
                      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                        {LEVEL_LABELS[level] || level} Chapters ({levelChildren.length})
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {levelChildren.map(child => (
                          <Link
                            key={child.id}
                            href={`/chapters/${child.id}`}
                            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <span className={`px-2 py-0.5 rounded text-white text-xs ${LEVEL_COLORS[child.level]}`}>
                              {LEVEL_LABELS[child.level]?.charAt(0) || child.level.charAt(0).toUpperCase()}
                            </span>
                            <span className="font-medium text-sm truncate">{child.name}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Simple list for fewer sub-chapters
                <div className="space-y-2">
                  {children.map(child => (
                    <Link
                      key={child.id}
                      href={`/chapters/${child.id}`}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <span className={`px-2 py-1 rounded text-white text-xs ${LEVEL_COLORS[child.level]}`}>
                        {LEVEL_LABELS[child.level] || child.level}
                      </span>
                      <span className="font-medium">{child.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Direct Members (Admin Only) */}
          {isAdmin && (
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Direct Members ({directMembers?.length || 0})</h2>
              {directMembers && directMembers.length > 0 ? (
                <div className="divide-y">
                  {directMembers.map(member => (
                    <div key={member.id} className="py-3 flex justify-between">
                      <div>
                        <div className="font-medium">{member.first_name} {member.last_name}</div>
                        <div className="text-sm text-gray-500">{member.email}</div>
                      </div>
                      <div className="text-sm text-gray-500">
                        Joined {new Date(member.joined_date).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">No direct members yet.</p>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Chapter Info Card */}
          <div className="card">
            <h3 className="font-semibold mb-3">About This Chapter</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>{LEVEL_LABELS[chapter.level]} Level</span>
              </div>
              {parent && (
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                  </svg>
                  <span>Part of {parent.name}</span>
                </div>
              )}
              {hasChildren && (
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <span>{children.length} sub-chapter{children.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>

          {/* Join CTA for non-members */}
          {!isMember && (
            <div className="card bg-labor-red-50 border-labor-red-200">
              <h3 className="font-semibold text-labor-red-900 mb-2">Join the Movement</h3>
              <p className="text-sm text-labor-red-800 mb-4">
                Become a member of {chapter.name} and help build a better future for working families.
              </p>
              <Link
                href={`/join?chapter=${id}`}
                className="block w-full text-center py-2 px-4 bg-labor-red text-white rounded-lg hover:bg-labor-red-600 transition-colors font-medium"
              >
                Join Now
              </Link>
            </div>
          )}

          {/* Quick Links */}
          <div className="card">
            <h3 className="font-semibold mb-3">Quick Links</h3>
            <div className="space-y-2">
              <Link
                href={`/events?chapter=${id}`}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-labor-red transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>All Chapter Events</span>
              </Link>
              <Link
                href="/initiatives"
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-labor-red transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                <span>Current Initiatives</span>
              </Link>
              <Link
                href="/contribute"
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-labor-red transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span>Contribute</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
