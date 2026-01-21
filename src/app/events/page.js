'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

function EventsContent() {
  const searchParams = useSearchParams()
  const chapterFilter = searchParams.get('chapter')

  const [events, setEvents] = useState([])
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedChapter, setSelectedChapter] = useState(chapterFilter || '')
  const [filterChapter, setFilterChapter] = useState(null)
  const [chapterSearch, setChapterSearch] = useState('')
  const [showChapterDropdown, setShowChapterDropdown] = useState(false)
  const [user, setUser] = useState(null)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowChapterDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (chapterFilter) {
      setSelectedChapter(chapterFilter)
    }
  }, [chapterFilter])

  async function loadData() {
    const supabase = createClient()

    // Check if user is logged in
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    setUser(currentUser)

    // Load chapters for filter
    const { data: chaptersData } = await supabase
      .from('chapters')
      .select('id, name, level')
      .order('name')

    setChapters(chaptersData || [])

    // If there's a chapter filter in URL, get chapter details
    if (chapterFilter) {
      const chapter = chaptersData?.find(c => c.id === chapterFilter)
      setFilterChapter(chapter || null)
    }

    // Load upcoming events
    const now = new Date().toISOString().split('T')[0]
    let query = supabase
      .from('events')
      .select(`
        id,
        title,
        start_date,
        start_time,
        end_time,
        location_name,
        description,
        chapter_id,
        chapters (
          id,
          name,
          level
        )
      `)
      .eq('status', 'published')
      .gte('start_date', now)
      .order('start_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (chapterFilter) {
      query = query.eq('chapter_id', chapterFilter)
    }

    const { data: eventsData } = await query

    // Get RSVP counts
    if (eventsData && eventsData.length > 0) {
      const eventIds = eventsData.map(e => e.id)

      const { data: rsvpCounts } = await supabase
        .from('event_rsvps')
        .select('event_id, status')
        .in('event_id', eventIds)
        .eq('status', 'attending')

      const countMap = {}
      rsvpCounts?.forEach(rsvp => {
        countMap[rsvp.event_id] = (countMap[rsvp.event_id] || 0) + 1
      })

      eventsData.forEach(event => {
        event.rsvpCount = countMap[event.id] || 0
      })
    }

    setEvents(eventsData || [])
    setLoading(false)
  }

  // Filter events by selected chapter
  const filteredEvents = selectedChapter
    ? events.filter(e => e.chapter_id === selectedChapter)
    : events

  // Group events by month
  const eventsByMonth = {}
  filteredEvents.forEach(event => {
    const date = new Date(event.start_date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    if (!eventsByMonth[monthKey]) {
      eventsByMonth[monthKey] = { label: monthLabel, events: [] }
    }
    eventsByMonth[monthKey].events.push(event)
  })

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl text-gray-900 mb-2">
          {filterChapter ? `${filterChapter.name} Events` : 'Upcoming Events'}
        </h1>
        <p className="text-gray-600">
          Find and join events in your community
        </p>
      </div>

      {/* Filters */}
      <div className="card mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Filter by Chapter</label>
            <div className="relative">
              <input
                type="text"
                value={chapterSearch}
                onChange={(e) => {
                  setChapterSearch(e.target.value)
                  setShowChapterDropdown(true)
                }}
                onFocus={() => setShowChapterDropdown(true)}
                placeholder={selectedChapter ? chapters.find(c => c.id === selectedChapter)?.name || 'Select chapter...' : 'Search chapters...'}
                className="input-field pr-8"
              />
              <button
                type="button"
                onClick={() => setShowChapterDropdown(!showChapterDropdown)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {showChapterDropdown && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                <button
                  onClick={() => {
                    setSelectedChapter('')
                    setChapterSearch('')
                    setShowChapterDropdown(false)
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${!selectedChapter ? 'bg-labor-red-50 text-labor-red' : 'text-gray-700'}`}
                >
                  All Chapters
                </button>
                {chapters
                  .filter(chapter =>
                    chapter.name.toLowerCase().includes(chapterSearch.toLowerCase()) ||
                    chapter.level.toLowerCase().includes(chapterSearch.toLowerCase())
                  )
                  .map(chapter => (
                    <button
                      key={chapter.id}
                      onClick={() => {
                        setSelectedChapter(chapter.id)
                        setChapterSearch('')
                        setShowChapterDropdown(false)
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${selectedChapter === chapter.id ? 'bg-labor-red-50 text-labor-red' : 'text-gray-700'}`}
                    >
                      {chapter.name} <span className="text-gray-400">({chapter.level})</span>
                    </button>
                  ))}
                {chapters.filter(chapter =>
                  chapter.name.toLowerCase().includes(chapterSearch.toLowerCase()) ||
                  chapter.level.toLowerCase().includes(chapterSearch.toLowerCase())
                ).length === 0 && (
                  <div className="px-4 py-2 text-sm text-gray-500">No chapters found</div>
                )}
              </div>
            )}
          </div>
          {selectedChapter && (
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSelectedChapter('')
                  setChapterSearch('')
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Clear Filter
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No upcoming events</h2>
          <p className="text-gray-600 mb-6">
            {selectedChapter
              ? 'There are no upcoming events for this chapter.'
              : 'Check back soon for new events!'}
          </p>
          {selectedChapter && (
            <button
              onClick={() => setSelectedChapter('')}
              className="text-labor-red hover:underline"
            >
              View all events
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(eventsByMonth).map(([monthKey, { label, events: monthEvents }]) => (
            <div key={monthKey}>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 sticky top-16 bg-gray-50 py-2 -mx-4 px-4 z-10">
                {label}
              </h2>
              <div className="space-y-4">
                {monthEvents.map(event => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="card block hover:shadow-md transition-shadow"
                  >
                    <div className="flex gap-4">
                      {/* Date badge */}
                      <div className="flex-shrink-0 w-14 text-center">
                        <div className="text-sm font-medium text-labor-red uppercase">
                          {new Date(event.start_date).toLocaleDateString('en-US', { month: 'short' })}
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                          {new Date(event.start_date).getDate()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(event.start_date).toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                      </div>

                      {/* Event details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 text-lg mb-1">{event.title}</h3>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mb-2">
                          {event.start_time && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {formatEventTime(event.start_time)}
                              {event.end_time && ` - ${formatEventTime(event.end_time)}`}
                            </span>
                          )}
                          {event.location_name && (
                            <span className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span className="truncate">{event.location_name}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          {event.chapters && (
                            <span className="text-sm text-gray-500">
                              {event.chapters.name}
                            </span>
                          )}
                          <span className="text-sm text-gray-500">
                            {event.rsvpCount || 0} going
                          </span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex-shrink-0 flex items-center text-gray-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Join CTA - only show to signed out visitors */}
      {!user && (
        <div className="mt-12 card bg-labor-red-50 border-labor-red-200">
          <div className="text-center">
            <h2 className="text-xl font-bold text-labor-red-900 mb-2">Want to host your own events?</h2>
            <p className="text-labor-red-800 mb-4">
              Join the Labor Party to create and host events in your community.
            </p>
            <Link
              href="/join"
              className="inline-block px-6 py-3 bg-labor-red text-white rounded-lg hover:bg-labor-red-600 transition-colors font-medium"
            >
              Become a Member
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

function EventsLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="h-9 bg-gray-200 rounded w-1/3 mb-2 animate-pulse"></div>
        <div className="h-5 bg-gray-200 rounded w-1/4 animate-pulse"></div>
      </div>
      <div className="card mb-8 animate-pulse">
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function EventsPage() {
  return (
    <Suspense fallback={<EventsLoading />}>
      <EventsContent />
    </Suspense>
  )
}
