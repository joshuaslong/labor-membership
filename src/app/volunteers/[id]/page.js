'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
}

function formatTime(timeStr) {
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

function VolunteerDetailContent() {
  const params = useParams()

  const [opportunity, setOpportunity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [member, setMember] = useState(null)
  const [error, setError] = useState(null)

  // Apply form state
  const [message, setMessage] = useState('')
  const [availabilityNotes, setAvailabilityNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  useEffect(() => {
    loadData()
  }, [params.id])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()

    let currentUser = null
    try {
      const { data } = await supabase.auth.getUser()
      currentUser = data?.user
    } catch {
      // Treat storage failures as not logged in
    }
    setUser(currentUser)

    if (currentUser) {
      const { data: memberData } = await supabase
        .from('members')
        .select('id, volunteer_skills, volunteer_interests')
        .eq('user_id', currentUser.id)
        .single()
      setMember(memberData)
    }

    const res = await fetch(`/api/volunteers/${params.id}`)
    if (!res.ok) {
      setLoading(false)
      setError('Opportunity not found')
      return
    }

    const data = await res.json()
    setOpportunity(data.opportunity)
    setLoading(false)
  }

  async function handleApply(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/volunteers/${params.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, availability_notes: availabilityNotes })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit application')
      }

      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleWithdraw() {
    setWithdrawing(true)
    setError(null)

    try {
      const res = await fetch(`/api/volunteers/${params.id}/apply`, {
        method: 'DELETE'
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to withdraw application')
      }

      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setWithdrawing(false)
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

  if (error && !opportunity) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Opportunity Not Found</h1>
          <p className="text-gray-600 mb-6">This opportunity may have been removed or is not yet published.</p>
          <Link href="/volunteers" className="text-labor-red hover:underline">
            &larr; Back to Opportunities
          </Link>
        </div>
      </div>
    )
  }

  const userApp = opportunity.user_application
  const isPastDeadline = opportunity.deadline && new Date() > new Date(opportunity.deadline + 'T23:59:59')
  const isFilled = opportunity.spots_remaining !== null && opportunity.spots_remaining <= 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/volunteers" className="text-gray-500 hover:text-gray-700 text-sm mb-6 inline-block">
        &larr; Back to Opportunities
      </Link>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <div className="card">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-start gap-3 mb-3">
                <h1 className="text-3xl text-gray-900">{opportunity.title}</h1>
                <span className={`flex-shrink-0 mt-1 inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${
                  opportunity.opportunity_type === 'one_time'
                    ? 'bg-purple-50 text-purple-700'
                    : 'bg-teal-50 text-teal-700'
                }`}>
                  {opportunity.opportunity_type === 'one_time' ? 'One-time' : 'Ongoing'}
                </span>
              </div>

              {opportunity.chapters && (
                <span className="inline-flex items-center gap-2 text-sm text-labor-red">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  {opportunity.chapters.name}
                </span>
              )}
            </div>

            {/* Details */}
            <div className="space-y-4 mb-6">
              {opportunity.opportunity_type === 'one_time' && opportunity.event_date && (
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-labor-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-labor-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{formatDate(opportunity.event_date)}</div>
                    {opportunity.start_time && (
                      <div className="text-gray-600">
                        {formatTime(opportunity.start_time)}
                        {opportunity.end_time && ` - ${formatTime(opportunity.end_time)}`}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(opportunity.location_name || opportunity.is_remote) && (
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-labor-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-labor-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Location</div>
                    <div className="text-gray-600">
                      {opportunity.is_remote ? 'Remote' : opportunity.location_name}
                    </div>
                  </div>
                </div>
              )}

              {opportunity.time_commitment && (
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 bg-labor-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-labor-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Time Commitment</div>
                    <div className="text-gray-600">{opportunity.time_commitment}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Skills */}
            {(opportunity.skills_needed || []).length > 0 && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold mb-3">Skills Needed</h2>
                <div className="flex flex-wrap gap-2">
                  {opportunity.skills_needed.map(skill => (
                    <span key={skill} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">
                      {skill}
                    </span>
                  ))}
                </div>
                {opportunity.skill_match && (
                  <p className="mt-2 text-sm text-green-700">
                    Your skills match this opportunity!
                  </p>
                )}
              </div>
            )}

            {/* Description */}
            {opportunity.description && (
              <div className="prose prose-gray max-w-none">
                <h2 className="text-lg font-semibold mb-3">About This Opportunity</h2>
                <div className="text-gray-700 whitespace-pre-wrap">{opportunity.description}</div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6 min-w-[320px]">
          {/* Application Card */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Apply</h3>
              {opportunity.spots_remaining != null && (
                <span className="text-sm text-gray-500">
                  {opportunity.spots_remaining} spot{opportunity.spots_remaining !== 1 ? 's' : ''} left
                </span>
              )}
            </div>

            {opportunity.deadline && (
              <p className={`text-xs mb-3 ${isPastDeadline ? 'text-red-600' : 'text-gray-500'}`}>
                {isPastDeadline ? 'Deadline passed: ' : 'Deadline: '}
                {formatDate(opportunity.deadline)}
              </p>
            )}

            {isPastDeadline ? (
              <div className="p-4 bg-gray-100 rounded-lg text-center text-gray-600">
                The application deadline has passed
              </div>
            ) : isFilled ? (
              <div className="p-4 bg-gray-100 rounded-lg text-center text-gray-600">
                This opportunity is fully staffed
              </div>
            ) : user && member ? (
              // Logged in member
              userApp ? (
                // Already applied
                <div>
                  <div className={`p-4 rounded-lg text-center mb-3 ${
                    userApp.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-200'
                      : userApp.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : userApp.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-gray-50 text-gray-600 border border-gray-200'
                  }`}>
                    <p className="font-medium">
                      {userApp.status === 'pending' ? 'Application Submitted'
                        : userApp.status === 'approved' ? 'Application Approved!'
                        : userApp.status === 'rejected' ? 'Application Not Selected'
                        : 'Application Withdrawn'}
                    </p>
                    {userApp.status === 'pending' && (
                      <p className="text-sm mt-1">We&apos;ll notify you when it&apos;s reviewed.</p>
                    )}
                  </div>
                  {(userApp.status === 'pending' || userApp.status === 'approved') && (
                    <button
                      onClick={handleWithdraw}
                      disabled={withdrawing}
                      className="w-full py-2 text-sm text-gray-500 hover:text-red-600 transition-colors"
                    >
                      {withdrawing ? 'Withdrawing...' : 'Withdraw Application'}
                    </button>
                  )}
                </div>
              ) : (
                // Apply form
                <form onSubmit={handleApply} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Why are you interested? (optional)
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="input-field"
                      rows={3}
                      placeholder="Tell us why you'd like to volunteer..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Availability notes (optional)
                    </label>
                    <textarea
                      value={availabilityNotes}
                      onChange={(e) => setAvailabilityNotes(e.target.value)}
                      className="input-field"
                      rows={2}
                      placeholder="Any scheduling constraints?"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full btn-primary"
                  >
                    {submitting ? 'Submitting...' : 'Submit Application'}
                  </button>
                </form>
              )
            ) : (
              // Not logged in
              <div className="space-y-3">
                <Link
                  href={`/login?redirect=/volunteers/${params.id}`}
                  className="block w-full text-center py-2 px-4 bg-labor-red text-white rounded-lg hover:bg-labor-red/90 transition-colors font-medium"
                >
                  Log in to Apply
                </Link>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-2 bg-white text-sm text-gray-500">or</span>
                  </div>
                </div>
                <Link
                  href="/join"
                  className="block w-full text-center py-2 px-4 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Join as a Member
                </Link>
              </div>
            )}

            {error && (
              <p className="mt-3 text-sm text-red-600 text-center">{error}</p>
            )}
          </div>

          {/* Join CTA for non-members */}
          {!member && user && (
            <div className="card bg-labor-red-50 border-labor-red-200">
              <h3 className="font-semibold text-labor-red-900 mb-2">Become a Member</h3>
              <p className="text-sm text-labor-red-800 mb-4">
                Join the Labor Party to apply for volunteer opportunities and connect with your community.
              </p>
              <Link
                href="/join"
                className="block w-full text-center py-2 px-4 bg-labor-red text-white rounded-lg hover:bg-labor-red-600 transition-colors font-medium"
              >
                Join Now
              </Link>
            </div>
          )}

          {/* Chapter Info */}
          {opportunity.chapters && (
            <div className="card">
              <h3 className="font-semibold mb-3">Posted by</h3>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-labor-red rounded-lg flex items-center justify-center text-white font-bold">
                  {opportunity.chapters.name.charAt(0)}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{opportunity.chapters.name}</div>
                  {opportunity.chapters.level && (
                    <div className="text-sm text-gray-500 capitalize">{opportunity.chapters.level} Chapter</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VolunteerDetailPage() {
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
      <VolunteerDetailContent />
    </Suspense>
  )
}
