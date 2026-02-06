'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function WorkspacePollsPage() {
  const [polls, setPolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchPolls = async () => {
      try {
        const res = await fetch('/api/polls')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setPolls(data.polls || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchPolls()
  }, [])

  // Group polls by status
  const actionNeeded = polls.filter(p => p.status === 'active' && !p.has_voted)
  const completed = polls.filter(p => p.has_voted)
  const closed = polls.filter(p => p.status === 'closed' && !p.has_voted)

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4">
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Polls</h1>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-8 text-center text-gray-500">
          Loading polls...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4">
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Polls</h1>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      </div>
    )
  }

  if (polls.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4">
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Polls</h1>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-12 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-sm font-medium text-gray-900">No polls available</p>
          <p className="text-xs text-gray-500 mt-1">Check back later for new polls</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Polls</h1>
      </div>

      <div className="space-y-6">
        {/* Action Needed Section */}
        {actionNeeded.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-labor-red rounded-full animate-pulse" />
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Action Needed
              </h2>
              <span className="text-xs text-gray-400">({actionNeeded.length})</span>
            </div>
            <div className="space-y-3">
              {actionNeeded.map(poll => (
                <PollCard key={poll.id} poll={poll} variant="action" />
              ))}
            </div>
          </section>
        )}

        {/* All caught up message */}
        {actionNeeded.length === 0 && completed.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-green-800">All caught up!</p>
              <p className="text-xs text-green-600">You've voted in all available polls</p>
            </div>
          </div>
        )}

        {/* Completed Section */}
        {completed.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Completed
              </h2>
              <span className="text-xs text-gray-400">({completed.length})</span>
            </div>
            <div className="space-y-3">
              {completed.map(poll => (
                <PollCard key={poll.id} poll={poll} variant="completed" />
              ))}
            </div>
          </section>
        )}

        {/* Closed Section */}
        {closed.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Closed
              </h2>
              <span className="text-xs text-gray-400">({closed.length})</span>
            </div>
            <div className="space-y-3">
              {closed.map(poll => (
                <PollCard key={poll.id} poll={poll} variant="closed" />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function PollCard({ poll, variant }) {
  const borderColor = {
    action: 'border-l-labor-red',
    completed: 'border-l-green-500',
    closed: 'border-l-gray-300',
  }[variant]

  const formatDate = (dateStr) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <Link
      href={`/workspace/polls/${poll.id}`}
      className={`block bg-white border border-stone-200 rounded-lg overflow-hidden hover:border-stone-300 hover:shadow-sm transition-all ${borderColor} border-l-4`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{poll.title}</h3>
            {poll.description && (
              <p className="text-xs text-gray-500 mb-2 line-clamp-1">{poll.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
              <span>{poll.question_count} question{poll.question_count !== 1 ? 's' : ''}</span>
              {poll.target_name && (
                <>
                  <span className="text-gray-300">·</span>
                  <span>{poll.target_name}</span>
                </>
              )}
              {variant === 'action' && poll.closes_at && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-amber-600">Closes {formatDate(poll.closes_at)}</span>
                </>
              )}
            </div>
          </div>
          <div className="shrink-0">
            {variant === 'action' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-labor-red text-white rounded-full">
                Vote Now
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            )}
            {variant === 'completed' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-full">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Voted
              </span>
            )}
            {variant === 'closed' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
                Closed
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
