'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'

const RSVP_COLORS = {
  attending: 'bg-green-50 text-green-700 border-green-200',
  maybe: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  declined: 'bg-red-50 text-red-700 border-red-200',
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

export default function EventRsvpsPage({ params }) {
  const { id } = use(params)
  const [event, setEvent] = useState(null)
  const [rsvps, setRsvps] = useState([])
  const [totals, setTotals] = useState({ attending: 0, maybe: 0, declined: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      // Load event details
      const eventRes = await fetch(`/api/events/${id}`)
      const eventData = await eventRes.json()

      if (!eventRes.ok) {
        throw new Error(eventData.error || 'Failed to load event')
      }

      setEvent(eventData.event)

      // Load RSVPs
      const rsvpsRes = await fetch(`/api/events/${id}/rsvps`)
      const rsvpsData = await rsvpsRes.json()

      if (!rsvpsRes.ok) {
        throw new Error(rsvpsData.error || 'Failed to load RSVPs')
      }

      setRsvps(rsvpsData.rsvps || [])
      setTotals(rsvpsData.totals || { attending: 0, maybe: 0, declined: 0 })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredRsvps = filter === 'all'
    ? rsvps
    : rsvps.filter(r => r.status === filter)

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading RSVPs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/admin/events" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block">
        ← Back to Events
      </Link>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {event && (
        <>
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{event.title}</h1>
            <p className="text-gray-600 mt-1">
              {formatDate(event.start_date)}
              {event.start_time && !event.is_all_day && ` at ${formatTime(event.start_time)}`}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{totals.attending}</div>
              <div className="text-sm text-gray-500">Attending</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{totals.maybe}</div>
              <div className="text-sm text-gray-500">Maybe</div>
            </div>
            <div className="card p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{totals.declined}</div>
              <div className="text-sm text-gray-500">Declined</div>
            </div>
          </div>

          {/* Filter */}
          <div className="card mb-6">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-labor-red text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({rsvps.length})
              </button>
              <button
                onClick={() => setFilter('attending')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'attending'
                    ? 'bg-green-600 text-white'
                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                Attending ({rsvps.filter(r => r.status === 'attending').length})
              </button>
              <button
                onClick={() => setFilter('maybe')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'maybe'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                }`}
              >
                Maybe ({rsvps.filter(r => r.status === 'maybe').length})
              </button>
              <button
                onClick={() => setFilter('declined')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'declined'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                Declined ({rsvps.filter(r => r.status === 'declined').length})
              </button>
            </div>
          </div>

          {/* RSVP List */}
          {filteredRsvps.length === 0 ? (
            <div className="card text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">No RSVPs yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                {filter === 'all'
                  ? 'When members RSVP, they will appear here.'
                  : `No one has responded with "${filter}".`}
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Guests</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRsvps.map((rsvp) => (
                    <tr key={rsvp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {rsvp.members?.first_name} {rsvp.members?.last_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {rsvp.members?.email}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${RSVP_COLORS[rsvp.status]}`}>
                          {rsvp.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {rsvp.guest_count > 0 ? `+${rsvp.guest_count}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                        {rsvp.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex gap-4">
            <Link href={`/admin/events/${id}`} className="btn-secondary">
              Edit Event
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
