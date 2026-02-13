'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function VolunteersContent() {
  const searchParams = useSearchParams()
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || '')
  const [skillFilter, setSkillFilter] = useState(searchParams.get('skill') || '')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const supabase = createClient()

    let currentUser = null
    try {
      const { data } = await supabase.auth.getUser()
      currentUser = data?.user
    } catch {
      // Treat storage failures as not logged in
    }
    setUser(currentUser)

    const params = new URLSearchParams({ status: 'published' })
    const res = await fetch(`/api/volunteers?${params.toString()}`)
    const data = await res.json()
    setOpportunities(data.opportunities || [])
    setLoading(false)
  }

  // Apply client-side filters
  const filtered = opportunities.filter(opp => {
    if (typeFilter && opp.opportunity_type !== typeFilter) return false
    if (skillFilter && !(opp.skills_needed || []).includes(skillFilter)) return false
    return true
  })

  // Collect all skills for the filter
  const allSkills = [...new Set(opportunities.flatMap(o => o.skills_needed || []))].sort()

  function formatDate(dateStr) {
    if (!dateStr) return null
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl text-gray-900 mb-2">Volunteer Opportunities</h1>
        <p className="text-gray-600">
          Find ways to get involved and make a difference in your community
        </p>
      </div>

      {/* Filters */}
      <div className="card mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input-field"
            >
              <option value="">All Types</option>
              <option value="one_time">One-time</option>
              <option value="ongoing">Ongoing</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Skill</label>
            <select
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              className="input-field"
            >
              <option value="">All Skills</option>
              {allSkills.map(skill => (
                <option key={skill} value={skill}>{skill}</option>
              ))}
            </select>
          </div>
          {(typeFilter || skillFilter) && (
            <div className="flex items-end">
              <button
                onClick={() => { setTypeFilter(''); setSkillFilter('') }}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-2/3 mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No opportunities available</h2>
          <p className="text-gray-600 mb-6">
            Check back soon for new volunteer opportunities!
          </p>
          {(typeFilter || skillFilter) && (
            <button
              onClick={() => { setTypeFilter(''); setSkillFilter('') }}
              className="text-labor-red hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map(opp => (
            <Link
              key={opp.id}
              href={`/volunteers/${opp.id}`}
              className="card block hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-gray-900 text-lg">{opp.title}</h3>
                <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  opp.opportunity_type === 'one_time'
                    ? 'bg-purple-50 text-purple-700'
                    : 'bg-teal-50 text-teal-700'
                }`}>
                  {opp.opportunity_type === 'one_time' ? 'One-time' : 'Ongoing'}
                </span>
              </div>

              {opp.skill_match && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 mb-2">
                  Skills Match!
                </span>
              )}

              {opp.user_application_status && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mb-2 ${
                  opp.user_application_status === 'approved' ? 'bg-green-50 text-green-700'
                    : opp.user_application_status === 'pending' ? 'bg-amber-50 text-amber-700'
                    : opp.user_application_status === 'rejected' ? 'bg-red-50 text-red-700'
                    : 'bg-gray-50 text-gray-600'
                }`}>
                  {opp.user_application_status === 'pending' ? 'Applied - Pending' :
                   opp.user_application_status === 'approved' ? 'Approved' :
                   opp.user_application_status === 'rejected' ? 'Not Selected' : 'Withdrawn'}
                </span>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 mb-3">
                {opp.opportunity_type === 'one_time' && opp.event_date && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(opp.event_date)}
                  </span>
                )}
                {opp.opportunity_type === 'ongoing' && opp.time_commitment && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {opp.time_commitment}
                  </span>
                )}
                {opp.is_remote ? (
                  <span className="text-gray-500">Remote</span>
                ) : opp.location_name ? (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {opp.location_name}
                  </span>
                ) : null}
              </div>

              {(opp.skills_needed || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {opp.skills_needed.slice(0, 4).map(skill => (
                    <span key={skill} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                      {skill}
                    </span>
                  ))}
                  {opp.skills_needed.length > 4 && (
                    <span className="text-xs text-gray-400">+{opp.skills_needed.length - 4} more</span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between text-sm">
                {opp.chapters && (
                  <span className="text-gray-500">{opp.chapters.name}</span>
                )}
                {opp.spots_remaining != null && (
                  <span className="text-gray-500">
                    {opp.spots_remaining} spot{opp.spots_remaining !== 1 ? 's' : ''} left
                  </span>
                )}
              </div>

              {opp.description && (
                <p className="mt-2 text-sm text-gray-600 line-clamp-2">{opp.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Join CTA */}
      {!user && (
        <div className="mt-12 card bg-labor-red-50 border-labor-red-200">
          <div className="text-center">
            <h2 className="text-xl font-bold text-labor-red-900 mb-2">Want to volunteer?</h2>
            <p className="text-labor-red-800 mb-4">
              Join the Labor Party to apply for volunteer opportunities and make a difference.
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

function VolunteersLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="h-9 bg-gray-200 rounded w-1/3 mb-2 animate-pulse"></div>
        <div className="h-5 bg-gray-200 rounded w-1/2 animate-pulse"></div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-2/3 mb-3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function VolunteersPage() {
  return (
    <Suspense fallback={<VolunteersLoading />}>
      <VolunteersContent />
    </Suspense>
  )
}
