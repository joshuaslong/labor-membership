import { createClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { getChapterScope } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import EventsToolbar from '@/components/EventsToolbar'
import EventRowActions from '@/components/EventRowActions'

const PAGE_SIZE = 50

export default async function EventsPage({ searchParams: searchParamsPromise }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const searchParams = await searchParamsPromise

  const supabase = await createClient()
  const page = Math.max(1, parseInt(searchParams?.page) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // Apply shared filters
  function applyFilters(q) {
    const scope = getChapterScope(teamMember.roles, teamMember.chapter_id)
    if (scope && scope.chapterId) {
      q = q.eq('chapter_id', scope.chapterId)
    }
    if (searchParams?.search) {
      const term = `%${searchParams.search}%`
      q = q.ilike('title', term)
    }
    if (searchParams?.status) {
      q = q.eq('status', searchParams.status)
    }
    if (searchParams?.time === 'upcoming') {
      const today = new Date().toISOString().split('T')[0]
      q = q.gte('start_date', today)
    } else if (searchParams?.time === 'past') {
      const today = new Date().toISOString().split('T')[0]
      q = q.lt('start_date', today)
    }
    return q
  }

  // Get total count
  let countQuery = supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
  countQuery = applyFilters(countQuery)
  const { count: totalCount } = await countQuery

  // Get page of data
  let query = supabase
    .from('events')
    .select(`
      id,
      title,
      description,
      location_name,
      location_city,
      location_state,
      is_virtual,
      start_date,
      start_time,
      end_date,
      end_time,
      status,
      is_all_day,
      max_attendees,
      created_at,
      chapter_id,
      chapters(name)
    `)
    .order('start_date', { ascending: false })
    .order('start_time', { ascending: false })
    .range(from, to)

  query = applyFilters(query)

  const { data: events, error } = await query

  if (error) {
    console.error('Error fetching events:', error)
    throw new Error('Failed to load events')
  }

  // Get RSVP counts for these events
  const eventIds = events?.map(e => e.id) || []
  let rsvpCounts = {}
  if (eventIds.length > 0) {
    const { data: rsvps } = await supabase
      .from('event_rsvps')
      .select('event_id, status')
      .in('event_id', eventIds)

    rsvpCounts = (rsvps || []).reduce((acc, r) => {
      if (!acc[r.event_id]) acc[r.event_id] = { attending: 0, maybe: 0 }
      if (r.status === 'attending') acc[r.event_id].attending++
      else if (r.status === 'maybe') acc[r.event_id].maybe++
      return acc
    }, {})
  }

  // Contextual page title
  const statusLabels = {
    draft: 'Draft Events',
    published: 'Published Events',
    cancelled: 'Cancelled Events',
  }
  const timeLabels = {
    upcoming: 'Upcoming Events',
    past: 'Past Events',
  }
  const pageTitle = searchParams?.status
    ? statusLabels[searchParams.status] || 'Events'
    : searchParams?.time
      ? timeLabels[searchParams.time] || 'Events'
      : 'All Events'

  const statusBadge = {
    draft: 'bg-amber-50 text-amber-700',
    published: 'bg-green-50 text-green-700',
    cancelled: 'bg-red-50 text-red-700',
  }

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE)
  const hasNext = page < totalPages
  const hasPrev = page > 1

  function pageUrl(p) {
    const params = new URLSearchParams()
    if (searchParams?.search) params.set('search', searchParams.search)
    if (searchParams?.status) params.set('status', searchParams.status)
    if (searchParams?.time) params.set('time', searchParams.time)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `/workspace/events?${qs}` : '/workspace/events'
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  function formatTime(timeStr) {
    if (!timeStr) return ''
    const [hours, minutes] = timeStr.split(':')
    const date = new Date()
    date.setHours(parseInt(hours), parseInt(minutes))
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  function formatLocation(event) {
    if (event.is_virtual) return 'Virtual'
    if (event.location_city && event.location_state) {
      return `${event.location_city}, ${event.location_state}`
    }
    return event.location_name || '—'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{pageTitle}</h1>
        {totalCount != null && (
          <span className="text-xs text-gray-400 tabular-nums">
            {totalCount} event{totalCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="mb-4">
        <EventsToolbar />
      </div>

      <div className="bg-white border border-stone-200 rounded overflow-hidden">
        {!events || events.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            <p>No events found.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-stone-200" aria-label="Events list">
            <caption className="sr-only">List of events with their details</caption>
            <thead className="bg-stone-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Event</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Location</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Chapter</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">RSVPs</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {events.map(event => {
                const counts = rsvpCounts[event.id] || { attending: 0, maybe: 0 }
                return (
                  <tr key={event.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/workspace/events/${event.id}`} className="text-gray-900 hover:text-labor-red font-medium">
                        {event.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                      <div>{formatDate(event.start_date)}</div>
                      {!event.is_all_day && event.start_time && (
                        <div className="text-xs text-gray-400">{formatTime(event.start_time)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatLocation(event)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{event.chapters?.name}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-gray-900">{counts.attending}</span>
                      {counts.maybe > 0 && (
                        <span className="text-gray-400 text-xs ml-1">(+{counts.maybe} maybe)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge[event.status] || 'bg-gray-50 text-gray-700'}`}>
                        {event.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <EventRowActions eventId={event.id} eventTitle={event.title} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
