'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  published: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
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

export default function AdminEventsPage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('upcoming')
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    loadEvents()
  }, [filter, statusFilter])

  const loadEvents = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      } else {
        params.set('status', 'all')
      }
      if (filter === 'upcoming') {
        params.set('upcoming', 'true')
      }

      const res = await fetch(`/api/events?${params.toString()}`)
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

  const handleDelete = async (eventId) => {
    if (!confirm('Are you sure you want to delete this event? This cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete event')
      }

      // Reload events
      loadEvents()
    } catch (err) {
      alert(err.message)
    }
  }

  const handlePublish = async (eventId) => {
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to publish event')
      }

      loadEvents()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleUnpublish = async (eventId) => {
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to unpublish event')
      }

      loadEvents()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link href="/admin" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block">
        ← Back to Admin
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-600">Create and manage chapter events</p>
        </div>
        <Link href="/admin/events/new" className="btn-primary">
          Create Event
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="input-field"
            >
              <option value="upcoming">Upcoming</option>
              <option value="all">All Events</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading events...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">No events found</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating your first event.</p>
          <Link href="/admin/events/new" className="btn-primary mt-4 inline-block">
            Create Event
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="card hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-lg font-semibold text-gray-900">{event.title}</h2>
                    <span className={`badge ${STATUS_COLORS[event.status]}`}>
                      {event.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span>
                        {formatDate(event.start_date)}
                        {event.start_time && !event.is_all_day && ` at ${formatTime(event.start_time)}`}
                        {event.is_all_day && ' (All day)'}
                      </span>
                    </div>
                    {event.location_name && (
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{event.location_name}</span>
                        {event.is_virtual && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Virtual</span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>{event.chapters?.name || 'Unknown chapter'}</span>
                    </div>
                  </div>
                  {event.status === 'published' && (
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <span className="text-green-600">
                        <strong>{event.rsvp_counts?.attending || 0}</strong> attending
                      </span>
                      <span className="text-yellow-600">
                        <strong>{event.rsvp_counts?.maybe || 0}</strong> maybe
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {event.status === 'draft' && (
                    <button
                      onClick={() => handlePublish(event.id)}
                      className="btn-primary text-sm py-1.5 px-3"
                    >
                      Publish
                    </button>
                  )}
                  {event.status === 'published' && (
                    <button
                      onClick={() => handleUnpublish(event.id)}
                      className="btn-secondary text-sm py-1.5 px-3"
                    >
                      Unpublish
                    </button>
                  )}
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="btn-secondary text-sm py-1.5 px-3"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/admin/events/${event.id}/rsvps`}
                    className="btn-secondary text-sm py-1.5 px-3"
                  >
                    RSVPs
                  </Link>
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="text-sm py-1.5 px-3 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
