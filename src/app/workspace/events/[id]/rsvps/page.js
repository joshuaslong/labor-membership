'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'

const STATUS_LABELS = {
  attending: 'Attending',
  maybe: 'Maybe',
  declined: 'Declined'
}

const STATUS_COLORS = {
  attending: 'bg-green-100 text-green-800',
  maybe: 'bg-yellow-100 text-yellow-800',
  declined: 'bg-red-100 text-red-800'
}

export default function EventRSVPsPage({ params }) {
  const { id } = use(params)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [event, setEvent] = useState(null)
  const [rsvps, setRsvps] = useState([])
  const [totals, setTotals] = useState({ attending: 0, maybe: 0, declined: 0 })
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

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

  const filteredRSVPs = rsvps.filter(rsvp => {
    // Status filter
    if (statusFilter !== 'all' && rsvp.status !== statusFilter) {
      return false
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const name = `${rsvp.members?.first_name || ''} ${rsvp.members?.last_name || ''}`.toLowerCase()
      const email = (rsvp.members?.email || '').toLowerCase()
      if (!name.includes(query) && !email.includes(query)) {
        return false
      }
    }

    return true
  })

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500">Loading RSVPs...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/workspace/events" className="hover:text-labor-red">Events</Link>
          <span>/</span>
          <Link href={`/workspace/events/${id}`} className="hover:text-labor-red">{event?.title}</Link>
          <span>/</span>
          <span className="text-gray-900">RSVPs</span>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            RSVPs for {event?.title}
          </h1>
          <Link
            href={`/workspace/events/${id}`}
            className="text-sm text-labor-red hover:text-labor-red/80"
          >
            ← Back to Event
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-stone-200 rounded p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Attending</div>
          <div className="text-2xl font-semibold text-green-600">{totals.attending}</div>
          {event?.max_attendees && (
            <div className="text-xs text-gray-400 mt-1">
              of {event.max_attendees} max
            </div>
          )}
        </div>
        <div className="bg-white border border-stone-200 rounded p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Maybe</div>
          <div className="text-2xl font-semibold text-yellow-600">{totals.maybe}</div>
        </div>
        <div className="bg-white border border-stone-200 rounded p-4">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Declined</div>
          <div className="text-2xl font-semibold text-red-600">{totals.declined}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-stone-200 rounded mb-4">
        <div className="p-4 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-stone-200 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-2 text-sm rounded ${
                statusFilter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-stone-200 text-gray-700 hover:bg-stone-50'
              }`}
            >
              All ({rsvps.length})
            </button>
            <button
              onClick={() => setStatusFilter('attending')}
              className={`px-3 py-2 text-sm rounded ${
                statusFilter === 'attending'
                  ? 'bg-green-600 text-white'
                  : 'bg-white border border-stone-200 text-gray-700 hover:bg-stone-50'
              }`}
            >
              Attending
            </button>
            <button
              onClick={() => setStatusFilter('maybe')}
              className={`px-3 py-2 text-sm rounded ${
                statusFilter === 'maybe'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-white border border-stone-200 text-gray-700 hover:bg-stone-50'
              }`}
            >
              Maybe
            </button>
            <button
              onClick={() => setStatusFilter('declined')}
              className={`px-3 py-2 text-sm rounded ${
                statusFilter === 'declined'
                  ? 'bg-red-600 text-white'
                  : 'bg-white border border-stone-200 text-gray-700 hover:bg-stone-50'
              }`}
            >
              Declined
            </button>
          </div>
        </div>
      </div>

      {/* RSVPs Table */}
      <div className="bg-white border border-stone-200 rounded overflow-hidden">
        <table className="min-w-full divide-y divide-stone-200">
          <thead className="bg-stone-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Guests
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                RSVP Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {filteredRSVPs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  {rsvps.length === 0 ? 'No RSVPs yet' : 'No RSVPs match your filters'}
                </td>
              </tr>
            ) : (
              filteredRSVPs.map((rsvp) => (
                <tr key={rsvp.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {rsvp.members ? (
                      <Link
                        href={`/workspace/members/${rsvp.members.id}`}
                        className="hover:text-labor-red"
                      >
                        {rsvp.members.first_name} {rsvp.members.last_name}
                      </Link>
                    ) : (
                      <span className="text-gray-400">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {rsvp.members?.email || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${STATUS_COLORS[rsvp.status]}`}>
                      {STATUS_LABELS[rsvp.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {rsvp.guest_count ? `+${rsvp.guest_count}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(rsvp.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                    {rsvp.notes || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer info */}
      <div className="mt-4 text-sm text-gray-500">
        Showing {filteredRSVPs.length} of {rsvps.length} RSVPs
      </div>
    </div>
  )
}
