'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function formatEventDate(dateStr) {
  const date = new Date(dateStr)
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

export default function EventDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [event, setEvent] = useState(null)
  const [chapter, setChapter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [member, setMember] = useState(null)
  const [rsvpStatus, setRsvpStatus] = useState(null)
  const [rsvpCount, setRsvpCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Guest RSVP form state
  const [showGuestForm, setShowGuestForm] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestSubmitting, setGuestSubmitting] = useState(false)
  const [guestSuccess, setGuestSuccess] = useState(false)

  useEffect(() => {
    loadEventData()
  }, [params.id])

  async function loadEventData() {
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

    // Fetch event
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', params.id)
      .eq('status', 'published')
      .single()

    if (eventError || !eventData) {
      setLoading(false)
      setError('Event not found')
      return
    }

    setEvent(eventData)

    // Fetch chapter
    const { data: chapterData } = await supabase
      .from('chapters')
      .select('id, name, level')
      .eq('id', eventData.chapter_id)
      .single()

    setChapter(chapterData)

    // Get RSVP count (members + guests)
    const { count: memberCount } = await supabase
      .from('event_rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', params.id)
      .eq('status', 'attending')

    const { count: guestCount } = await supabase
      .from('event_guest_rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', params.id)
      .eq('status', 'attending')

    setRsvpCount((memberCount || 0) + (guestCount || 0))

    // Get user's RSVP if logged in
    if (memberId) {
      const { data: rsvpData } = await supabase
        .from('event_rsvps')
        .select('status')
        .eq('event_id', params.id)
        .eq('member_id', memberId)
        .single()

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
        body: JSON.stringify({ status })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update RSVP')
      }

      setRsvpStatus(status)
      // Reload to get updated count
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
      const res = await fetch(`/api/events/${params.id}/rsvp`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel RSVP')
      }

      setRsvpStatus(null)
      // Reload to get updated count
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
          email: guestEmail
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

  const isPastEvent = new Date(event.start_date) < new Date(new Date().toDateString())

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
                    {formatEventDate(event.start_date)}
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
        <div className="space-y-6">
          {/* RSVP Card */}
          <div className="card min-w-[280px]">
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
                    className={`py-2.5 px-3 text-sm rounded-lg border transition-colors ${
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
                    className={`py-2.5 px-3 text-sm rounded-lg border transition-colors ${
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
                    className={`py-2.5 px-3 text-sm rounded-lg border transition-colors ${
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
                  href={`/login?redirect=/events/${params.id}`}
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
