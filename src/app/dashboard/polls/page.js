'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function MemberPollsPage() {
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

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading polls...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block">
        &larr; Back to Dashboard
      </Link>

      <h1 className="text-2xl sm:text-3xl text-gray-900 mb-6">Polls</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      )}

      {polls.length === 0 ? (
        <div className="text-center py-12 card">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No active polls</h3>
          <p className="text-gray-500 text-sm">Check back later for new polls.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {polls.map(poll => (
            <Link
              key={poll.id}
              href={`/dashboard/polls/${poll.id}`}
              className="card block hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1">{poll.title}</h3>
                  {poll.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{poll.description}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>{poll.question_count} question{poll.question_count !== 1 ? 's' : ''}</span>
                    {poll.target_name && <span>{poll.target_name}</span>}
                    {poll.closes_at && (
                      <span>Closes: {new Date(poll.closes_at).toLocaleDateString()}</span>
                    )}
                    {poll.status === 'closed' && (
                      <span className="text-blue-600">Poll closed</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  {poll.has_voted ? (
                    <span className="px-3 py-1 bg-green-50 text-green-700 text-sm font-medium rounded-full">
                      Voted
                    </span>
                  ) : poll.status === 'active' ? (
                    <span className="px-3 py-1 bg-labor-red text-white text-sm font-medium rounded-full">
                      Vote Now
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-gray-100 text-gray-500 text-sm font-medium rounded-full">
                      Closed
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
