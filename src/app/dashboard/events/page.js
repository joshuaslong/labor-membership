'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const RSVP_COLORS = {
  attending: 'bg-green-100 text-green-700 border-green-300',
  maybe: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  declined: 'bg-gray-100 text-gray-600 border-gray-300',
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [hours, minutes] = timeStr.split(':')
  const h = parseInt(hours)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${minutes} ${ampm}`
}

function formatDateShort(dateStr) {
  if (!dateStr) return { month: '', day: '' }
  const date = new Date(dateStr)
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    day: date.getDate()
  }
}

export default function MemberEventsPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [rsvpLoading, setRsvpLoading] = useState(null)

  useEffect(() => {
    loadEvents()
  }, [])

  const loadEvents = async () => {
    try {
      const res = await fetch('/api/events?status=published&upcoming=true')
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load events')
      }

      setEvents(data.events || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleRsvp = async (eventId, status) => {
    setRsvpLoading(eventId)
    try {
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to RSVP')
      }

      // Update local state
      setEvents(prev => prev.map(event => {
        if (event.id === eventId) {
          return {
            ...event,
            user_rsvp: { status, guest_count: 0 },
            rsvp_counts: {
              ...event.rsvp_counts,
              [status]: (event.rsvp_counts[status] || 0) + 1,
              ...(event.user_rsvp?.status && event.user_rsvp.status !== status ? {
                [event.user_rsvp.status]: Math.max(0, (event.rsvp_counts[event.user_rsvp.status] || 0) - 1)
              } : {})
            }
          }
        }
        return event
      }))
    } catch (err) {
      alert(err.message)
    } finally {
      setRsvpLoading(null)
    }
  }

  const handleCancelRsvp = async (eventId) => {
    setRsvpLoading(eventId)
    try {
      const event = events.find(e => e.id === eventId)
      const res = await fetch(`/api/events/${eventId}/rsvp`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to cancel RSVP')
      }

      // Update local state
      setEvents(prev => prev.map(e => {
        if (e.id === eventId) {
          return {
            ...e,
            user_rsvp: null,
            rsvp_counts: {
              ...e.rsvp_counts,
              [event.user_rsvp?.status]: Math.max(0, (e.rsvp_counts[event.user_rsvp?.status] || 0) - 1)
            }
          }
        }
        return e
      }))
    } catch (err) {
      alert(err.message)
    } finally {
      setRsvpLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading events...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Upcoming Events</h1>
        <p className="text-gray-600">Events from your chapter and the national party</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {events.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No upcoming events</h3>
          <p className="mt-1 text-sm text-gray-500">
            Check back later for new events from your chapter.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {events.map((event) => {
            const dateInfo = formatDateShort(event.start_date)
            const isLoading = rsvpLoading === event.id

            return (
              <div key={event.id} className="card hover:shadow-md transition-shadow">
                <div className="flex gap-4">
                  {/* Date badge */}
                  <div className="flex-shrink-0 w-16 text-center">
                    <div className="bg-labor-red text-white text-xs font-medium py-1 rounded-t">
                      {dateInfo.month}
                    </div>
                    <div className="border border-t-0 border-gray-200 rounded-b py-2">
                      <span className="text-2xl font-bold text-gray-900">{dateInfo.day}</span>
                    </div>
                  </div>

                  {/* Event details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-lg font-semibold text-gray-900">{event.title}</h2>
                      {event.user_rsvp && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${RSVP_COLORS[event.user_rsvp.status]}`}>
                          {event.user_rsvp.status === 'attending' ? "You're going" :
                           event.user_rsvp.status === 'maybe' ? 'Maybe' : 'Declined'}
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-gray-600 space-y-1 mb-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                          {event.is_all_day ? 'All day' : (
                            <>
                              {formatTime(event.start_time)}
                              {event.end_time && ` - ${formatTime(event.end_time)}`}
                            </>
                          )}
                        </span>
                      </div>

                      {event.location_name && (
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>
                            {event.location_name}
                            {event.is_virtual && (
                              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Virtual</span>
                            )}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-gray-500">{event.chapters?.name}</span>
                      </div>
                    </div>

                    {event.description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{event.description}</p>
                    )}

                    {/* RSVP counts */}
                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                      <span className="text-green-600">{event.rsvp_counts?.attending || 0} attending</span>
                      <span className="text-yellow-600">{event.rsvp_counts?.maybe || 0} maybe</span>
                    </div>

                    {/* RSVP buttons */}
                    <div className="flex flex-wrap gap-2">
                      {event.user_rsvp ? (
                        <>
                          {event.user_rsvp.status !== 'attending' && (
                            <button
                              onClick={() => handleRsvp(event.id, 'attending')}
                              disabled={isLoading}
                              className="btn-primary text-sm py-1.5 px-4"
                            >
                              {isLoading ? '...' : "I'm Going"}
                            </button>
                          )}
                          {event.user_rsvp.status !== 'maybe' && (
                            <button
                              onClick={() => handleRsvp(event.id, 'maybe')}
                              disabled={isLoading}
                              className="btn-secondary text-sm py-1.5 px-4"
                            >
                              {isLoading ? '...' : 'Maybe'}
                            </button>
                          )}
                          <button
                            onClick={() => handleCancelRsvp(event.id)}
                            disabled={isLoading}
                            className="text-sm py-1.5 px-4 text-gray-500 hover:text-gray-700"
                          >
                            {isLoading ? '...' : 'Cancel RSVP'}
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleRsvp(event.id, 'attending')}
                            disabled={isLoading}
                            className="btn-primary text-sm py-1.5 px-4"
                          >
                            {isLoading ? '...' : "I'm Going"}
                          </button>
                          <button
                            onClick={() => handleRsvp(event.id, 'maybe')}
                            disabled={isLoading}
                            className="btn-secondary text-sm py-1.5 px-4"
                          >
                            {isLoading ? '...' : 'Maybe'}
                          </button>
                          <button
                            onClick={() => handleRsvp(event.id, 'declined')}
                            disabled={isLoading}
                            className="text-sm py-1.5 px-4 text-gray-500 hover:text-gray-700"
                          >
                            {isLoading ? '...' : "Can't Go"}
                          </button>
                        </>
                      )}

                      {event.is_virtual && event.virtual_link && event.user_rsvp?.status === 'attending' && (
                        <a
                          href={event.virtual_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm py-1.5 px-4 text-blue-600 hover:text-blue-800"
                        >
                          Join Meeting →
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
