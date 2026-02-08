'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function formatEventDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
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

function EventDetailContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const dateParam = searchParams.get('date')

  const [event, setEvent] = useState(null)
  const [chapter, setChapter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [member, setMember] = useState(null)
  const [rsvpStatus, setRsvpStatus] = useState(null)
  const [rsvpCount, setRsvpCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Recurring event state
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceDescription, setRecurrenceDescription] = useState(null)
  const [instanceDate, setInstanceDate] = useState(null)
  const [upcomingInstances, setUpcomingInstances] = useState([])

  // Guest RSVP form state
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestSubmitting, setGuestSubmitting] = useState(false)
  const [guestSuccess, setGuestSuccess] = useState(false)

  useEffect(() => {
    loadEventData()
  }, [params.id, dateParam])

  async function loadEventData() {
    setLoading(true)
    const supabase = createClient()

    // Get current user
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    setUser(currentUser)

    // Get member record if logged in
    let memberId = null
    if (currentUser) {
      const { data: memberData } = await supabase
        .from('members')
        .select('id')
        .eq('user_id', currentUser.id)
        .single()
      setMember(memberData)
      memberId = memberData?.id
    }

    // Fetch event via API (handles recurring instance merging)
    const apiUrl = dateParam
      ? `/api/events/${params.id}?instance_date=${dateParam}`
      : `/api/events/${params.id}`

    const res = await fetch(apiUrl)
    if (!res.ok) {
      setLoading(false)
      setError('Event not found')
      return
    }

    const data = await res.json()
    const eventData = data.event

    setEvent(eventData)
    setIsRecurring(eventData.is_recurring || false)
    setRecurrenceDescription(eventData.recurrence_description || null)
    setUpcomingInstances(eventData.upcoming_instances || [])

    // Determine the instance date for RSVP operations
    const effectiveDate = dateParam || eventData.start_date
    setInstanceDate(effectiveDate)

    // Fetch chapter
    if (eventData.chapter_id) {
      const { data: chapterData } = await supabase
        .from('chapters')
        .select('id, name, level')
        .eq('id', eventData.chapter_id)
        .single()
      setChapter(chapterData)
    }

    // RSVP count comes from API response
    setRsvpCount(eventData.rsvp_counts?.attending || 0)

    // Get user's RSVP if logged in (for this specific instance)
    if (memberId) {
      const rsvpQuery = supabase
        .from('event_rsvps')
        .select('status')
        .eq('event_id', params.id)
        .eq('member_id', memberId)
        .eq('instance_date', effectiveDate)
        .single()

      const { data: rsvpData } = await rsvpQuery
      setRsvpStatus(rsvpData?.status || null)
    }

    setLoading(false)
  }

  async function handleRsvp(status) {
    if (!member) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/events/${params.id}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, instance_date: instanceDate })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update RSVP')
      }

      setRsvpStatus(status)
      loadEventData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancelRsvp() {
    if (!member) return

    setSubmitting(true)
    setError(null)

    try {
      const instanceParam = instanceDate ? `?instance_date=${instanceDate}` : ''
      const res = await fetch(`/api/events/${params.id}/rsvp${instanceParam}`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel RSVP')
      }

      setRsvpStatus(null)
      loadEventData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGuestRsvp(e) {
    e.preventDefault()
    setGuestSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/events/${params.id}/guest-rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: guestName,
          email: guestEmail,
          instance_date: instanceDate
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit RSVP')
      }

      setGuestSuccess(true)
      setShowGuestForm(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuestSubmitting(false)
    }
  }

  // Find previous and next instances for navigation
  function getInstanceNav() {
    if (!isRecurring || !instanceDate || upcomingInstances.length === 0) return { prev: null, next: null }

    // Find instances before and after current
    const sorted = [...upcomingInstances].sort()
    let prev = null
    let next = null

    for (const d of sorted) {
      if (d < instanceDate) prev = d
      if (d > instanceDate && !next) next = d
    }

    return { prev, next }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-12 bg-gray-200 rounded w-2/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    )
  }

  if (error && !event) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Event Not Found</h1>
          <p className="text-gray-600 mb-6">This event may have been removed or is not yet published.</p>
          <Link href="/events" className="text-labor-red hover:underline">
            ← Back to Events
          </Link>
        </div>
      </div>
    )
  }

  const displayDate = instanceDate || event.start_date
  const isPastEvent = new Date(displayDate) < new Date(new Date().toDateString())
  const { prev: prevInstance, next: nextInstance } = getInstanceNav()

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/events" className="text-gray-500 hover:text-gray-700 text-sm mb-6 inline-block">
        ← Back to Events
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <div className="card">
            {/* Event Header */}
            <div className="mb-6">
              <h1 className="text-3xl text-gray-900 mb-3">{event.title}</h1>

              {isRecurring && recurrenceDescription && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Recurring: {recurrenceDescription}</span>
                </div>
              )}

              {chapter && (
                <Link
                  href={`/chapters/${chapter.id}`}
                  className="inline-flex items-center gap-2 text-sm text-labor-red hover:underline"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Hosted by {chapter.name}
                </Link>
              )}
            </div>

            {/* Instance navigation for recurring events */}
            {isRecurring && (prevInstance || nextInstance) && (
              <div className="flex items-center justify-between mb-6 p-3 bg-gray-50 rounded-lg border border-gray-100">
                {prevInstance ? (
                  <Link
                    href={`/events/${params.id}?date=${prevInstance}`}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {formatEventDate(prevInstance)}
                  </Link>
                ) : <span />}
                {nextInstance ? (
                  <Link
                    href={`/events/${params.id}?date=${nextInstance}`}
                    className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                  >
                    {formatEventDate(nextInstance)}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ) : <span />}
              </div>
            )}

            {/* Event Details */}
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-labor-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-labor-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">
                    {formatEventDate(displayDate)}
                  </div>
                  {event.start_time && (
                    <div className="text-gray-600">
                      {formatEventTime(event.start_time)}
                      {event.end_time && ` - ${formatEventTime(event.end_time)}`}
                    </div>
                  )}
                </div>
              </div>

              {event.location_name && (
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-labor-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-labor-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Location</div>
                    <div className="text-gray-600">{event.location_name}</div>
                  </div>
                </div>
              )}

              {event.virtual_link && user && (
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-labor-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-labor-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Virtual Link</div>
                    <a
                      href={event.virtual_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-labor-red hover:underline break-all"
                    >
                      Join Online
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            {event.description && (
              <div className="prose prose-gray max-w-none">
                <h2 className="text-lg font-semibold mb-3">About This Event</h2>
                <div className="text-gray-700 whitespace-pre-wrap">{event.description}</div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 min-w-[320px]">
          {/* RSVP Card */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Attendance</h3>
              <span className="text-sm text-gray-500">{rsvpCount} going</span>
            </div>

            {isPastEvent ? (
              <div className="p-4 bg-gray-100 rounded-lg text-center text-gray-600">
                This event has already passed
              </div>
            ) : user && member ? (
              // Logged in member RSVP
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleRsvp('attending')}
                    disabled={submitting}
                    className={`py-2.5 px-3 text-sm rounded-lg border transition-colors whitespace-nowrap ${
                      rsvpStatus === 'attending'
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {rsvpStatus === 'attending' ? '✓ Going' : 'Going'}
                  </button>
                  <button
                    onClick={() => handleRsvp('maybe')}
                    disabled={submitting}
                    className={`py-2.5 px-3 text-sm rounded-lg border transition-colors whitespace-nowrap ${
                      rsvpStatus === 'maybe'
                        ? 'bg-yellow-50 border-yellow-300 text-yellow-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {rsvpStatus === 'maybe' ? '✓ Maybe' : 'Maybe'}
                  </button>
                  <button
                    onClick={() => handleRsvp('declined')}
                    disabled={submitting}
                    className={`py-2.5 px-3 text-sm rounded-lg border transition-colors whitespace-nowrap ${
                      rsvpStatus === 'declined'
                        ? 'bg-gray-100 border-gray-300 text-gray-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {rsvpStatus === 'declined' ? '✓ Can\'t Go' : 'Can\'t Go'}
                  </button>
                </div>
                {rsvpStatus && (
                  <button
                    onClick={handleCancelRsvp}
                    disabled={submitting}
                    className="w-full py-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
                  >
                    {submitting ? 'Canceling...' : 'Cancel RSVP'}
                  </button>
                )}
              </div>
            ) : guestSuccess ? (
              // Guest RSVP success
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                <svg className="w-8 h-8 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-green-700 font-medium">RSVP Received!</p>
                <p className="text-sm text-green-600 mt-1">We'll send you event updates.</p>
              </div>
            ) : showGuestForm ? (
              // Guest RSVP form
              <form onSubmit={handleGuestRsvp} className="space-y-4">
                <div>
                  <label className="label">Your Name</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    required
                    className="input-field"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="label">Email Address</label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    required
                    className="input-field"
                    placeholder="you@example.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={guestSubmitting}
                  className="w-full btn-primary"
                >
                  {guestSubmitting ? 'Submitting...' : 'Submit RSVP'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGuestForm(false)}
                  className="w-full text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </form>
            ) : (
              // Guest options
              <div className="space-y-3">
                <button
                  onClick={() => setShowGuestForm(true)}
                  className="w-full btn-primary"
                >
                  RSVP as Guest
                </button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-2 bg-white text-sm text-gray-500">or</span>
                  </div>
                </div>
                <Link
                  href={`/login?redirect=/events/${params.id}${dateParam ? `?date=${dateParam}` : ''}`}
                  className="block w-full text-center py-2 px-4 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Log in to RSVP
                </Link>
              </div>
            )}

            {error && (
              <p className="mt-3 text-sm text-red-600 text-center">{error}</p>
            )}
          </div>

          {/* Join CTA for non-members */}
          {!member && (
            <div className="card bg-labor-red-50 border-labor-red-200">
              <h3 className="font-semibold text-labor-red-900 mb-2">Join the Movement</h3>
              <p className="text-sm text-labor-red-800 mb-4">
                Become a member to get full access to events, connect with other members, and make your voice heard.
              </p>
              <Link
                href={chapter ? `/join?chapter=${chapter.id}` : '/join'}
                className="block w-full text-center py-2 px-4 bg-labor-red text-white rounded-lg hover:bg-labor-red-600 transition-colors font-medium"
              >
                Join Now
              </Link>
            </div>
          )}

          {/* Upcoming instances for recurring events */}
          {isRecurring && upcomingInstances.length > 1 && (
            <div className="card">
              <h3 className="font-semibold mb-3">Upcoming Dates</h3>
              <div className="space-y-2">
                {upcomingInstances.slice(0, 5).map(d => (
                  <Link
                    key={d}
                    href={`/events/${params.id}?date=${d}`}
                    className={`block px-3 py-2 text-sm rounded-lg transition-colors ${
                      d === instanceDate
                        ? 'bg-labor-red-50 text-labor-red font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {formatEventDate(d)}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Chapter Info */}
          {chapter && (
            <div className="card">
              <h3 className="font-semibold mb-3">Hosting Chapter</h3>
              <Link
                href={`/chapters/${chapter.id}`}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 bg-labor-red rounded-lg flex items-center justify-center text-white font-bold">
                  {chapter.name.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{chapter.name}</div>
                  <div className="text-sm text-gray-500 capitalize">{chapter.level} Chapter</div>
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function EventDetailPage() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-12 bg-gray-200 rounded w-2/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    }>
      <EventDetailContent />
    </Suspense>
  )
}
