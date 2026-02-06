'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function WorkspacePollsPage() {
  const searchParams = useSearchParams()
  const statusFilter = searchParams.get('status') || ''

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

  // Apply client-side filtering
  const filteredPolls = polls.filter(poll => {
    if (!statusFilter) return true
    if (statusFilter === 'active') return poll.status === 'active' && !poll.has_voted
    if (statusFilter === 'voted') return poll.has_voted
    if (statusFilter === 'closed') return poll.status === 'closed'
    return true
  })

  // Count stats
  const stats = {
    total: polls.length,
    active: polls.filter(p => p.status === 'active' && !p.has_voted).length,
    voted: polls.filter(p => p.has_voted).length,
    closed: polls.filter(p => p.status === 'closed').length,
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4">
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Polls</h1>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-8 text-center text-gray-500">
          Loading polls...
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Polls</h1>
        <span className="text-xs text-gray-400 tabular-nums">
          {filteredPolls.length} poll{filteredPolls.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white border border-stone-200 rounded-lg p-3 text-center">
          <div className="text-xl font-semibold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-500">Total</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-3 text-center">
          <div className="text-xl font-semibold text-labor-red">{stats.active}</div>
          <div className="text-xs text-gray-500">Need Vote</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-3 text-center">
          <div className="text-xl font-semibold text-green-600">{stats.voted}</div>
          <div className="text-xs text-gray-500">Completed</div>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-3 text-center">
          <div className="text-xl font-semibold text-gray-500">{stats.closed}</div>
          <div className="text-xs text-gray-500">Closed</div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Polls List */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        {filteredPolls.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p className="text-sm font-medium">No polls found</p>
            <p className="text-xs text-gray-400 mt-1">
              {statusFilter ? 'Try a different filter' : 'Check back later for new polls'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filteredPolls.map(poll => (
              <Link
                key={poll.id}
                href={`/workspace/polls/${poll.id}`}
                className="flex items-center justify-between px-4 py-4 hover:bg-stone-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium text-gray-900 truncate">{poll.title}</h3>
                    {poll.status === 'closed' && (
                      <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                        Closed
                      </span>
                    )}
                  </div>
                  {poll.description && (
                    <p className="text-xs text-gray-500 truncate mb-1">{poll.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
                    <span>{poll.question_count} question{poll.question_count !== 1 ? 's' : ''}</span>
                    {poll.target_name && <span>{poll.target_name}</span>}
                    {poll.closes_at && (
                      <span>Closes {new Date(poll.closes_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  {poll.has_voted ? (
                    <span className="px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-full">
                      Voted
                    </span>
                  ) : poll.status === 'active' ? (
                    <span className="px-2.5 py-1 text-xs font-medium bg-labor-red text-white rounded-full">
                      Vote Now
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
                      Closed
                    </span>
                  )}
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
