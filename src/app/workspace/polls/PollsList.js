'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function PollsList() {
  const searchParams = useSearchParams()
  const filter = searchParams.get('filter') || ''

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
    if (!filter) return true
    if (filter === 'needs_vote') return poll.status === 'active' && !poll.has_voted
    if (filter === 'voted') return poll.has_voted
    if (filter === 'closed') return poll.status === 'closed'
    return true
  })

  // Page title based on filter
  const filterLabels = {
    needs_vote: 'Polls Needing Vote',
    voted: 'Voted Polls',
    closed: 'Closed Polls',
  }
  const pageTitle = filter ? filterLabels[filter] || 'All Polls' : 'All Polls'

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4">
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{pageTitle}</h1>
        </div>
        <div className="bg-white border border-stone-200 rounded p-8 text-center text-gray-500">
          Loading polls...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4">
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{pageTitle}</h1>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{pageTitle}</h1>
        <span className="text-xs text-gray-400 tabular-nums">
          {filteredPolls.length} poll{filteredPolls.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="bg-white border border-stone-200 rounded overflow-hidden">
        {filteredPolls.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            <p>No polls found.</p>
          </div>
        ) : (
          <>
          {/* Mobile card view */}
          <div className="md:hidden divide-y divide-stone-100">
            {filteredPolls.map(poll => (
              <Link key={poll.id} href={`/workspace/polls/${poll.id}`} className="block px-4 py-3 hover:bg-stone-50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{poll.title}</p>
                    {poll.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{poll.description}</p>
                    )}
                  </div>
                  {poll.has_voted ? (
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">Voted</span>
                  ) : poll.status === 'active' ? (
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">Needs Vote</span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">Closed</span>
                  )}
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
                  {poll.target_name && <span>{poll.target_name}</span>}
                  <span>{poll.question_count} question{poll.question_count !== 1 ? 's' : ''}</span>
                  <span>Closes {formatDate(poll.closes_at)}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop table */}
          <table className="hidden md:table min-w-full divide-y divide-stone-200" aria-label="Polls list">
            <caption className="sr-only">List of polls</caption>
            <thead className="bg-stone-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Poll</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Chapter</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Questions</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Closes</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredPolls.map(poll => (
                <tr key={poll.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 text-sm">
                    <Link href={`/workspace/polls/${poll.id}`} className="text-gray-900 hover:text-labor-red font-medium">
                      {poll.title}
                    </Link>
                    {poll.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{poll.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {poll.target_name || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                    {poll.question_count}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                    {formatDate(poll.closes_at)}
                  </td>
                  <td className="px-4 py-3">
                    {poll.has_voted ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                        Voted
                      </span>
                    ) : poll.status === 'active' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">
                        Needs Vote
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        Closed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </div>
    </div>
  )
}
