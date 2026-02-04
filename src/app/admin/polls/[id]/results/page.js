'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

const STATUS_LABELS = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  active: { label: 'Active', className: 'bg-green-50 text-green-700' },
  closed: { label: 'Closed', className: 'bg-blue-50 text-blue-700' },
  archived: { label: 'Archived', className: 'bg-gray-100 text-gray-500' },
}

export default function PollResultsPage() {
  const params = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedQuestions, setExpandedQuestions] = useState(new Set())

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const res = await fetch(`/api/admin/polls/${params.id}/results`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        setData(json)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchResults()
  }, [params.id])

  const toggleQuestion = (qId) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev)
      if (next.has(qId)) {
        next.delete(qId)
      } else {
        next.add(qId)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading results...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <Link href="/admin/polls" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block">
          &larr; Back to Polls
        </Link>
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      </div>
    )
  }

  const { poll, total_eligible, total_voters, response_rate, questions } = data

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/admin/polls" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block">
        &larr; Back to Polls
      </Link>

      {/* Poll header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl sm:text-3xl text-gray-900">{poll.title}</h1>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[poll.status]?.className || 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABELS[poll.status]?.label || poll.status}
          </span>
        </div>
        <p className="text-gray-500 text-sm">
          {poll.target_type === 'group' ? `Group: ${poll.chapter_groups?.name}` : `Chapter: ${poll.chapters?.name}`}
          {poll.results_visibility === 'after_close' && ' | Results shown after close'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{total_eligible}</div>
          <div className="text-xs text-gray-500">Eligible</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-labor-red">{total_voters}</div>
          <div className="text-xs text-gray-500">Voted</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{response_rate}%</div>
          <div className="text-xs text-gray-500">Response Rate</div>
        </div>
      </div>

      {/* Results by question */}
      <div className="space-y-6">
        {questions.map((question, qi) => {
          const maxVotes = Math.max(...question.options.map(o => o.vote_count), 1)
          const isExpanded = expandedQuestions.has(question.id)

          return (
            <div key={question.id} className="card">
              <h3 className="font-semibold text-gray-900 mb-4">
                Q{qi + 1}. {question.question_text}
              </h3>

              {/* Bar chart */}
              <div className="space-y-3 mb-4">
                {question.options.map(option => (
                  <div key={option.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{option.option_text}</span>
                      <span className="text-gray-500">
                        {option.vote_count} vote{option.vote_count !== 1 ? 's' : ''} ({option.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-6">
                      <div
                        className="bg-labor-red rounded-full h-6 transition-all duration-300"
                        style={{ width: `${total_voters > 0 ? (option.vote_count / maxVotes) * 100 : 0}%`, minWidth: option.vote_count > 0 ? '8px' : '0' }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Toggle voter details */}
              <button
                onClick={() => toggleQuestion(question.id)}
                className="text-sm text-labor-red hover:underline"
              >
                {isExpanded ? 'Hide voter details' : 'Show voter details'}
              </button>

              {isExpanded && (
                <div className="mt-4 border-t pt-4">
                  {question.options.map(option => (
                    option.voters.length > 0 && (
                      <div key={option.id} className="mb-4 last:mb-0">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">
                          {option.option_text} ({option.voters.length})
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-500 border-b">
                                <th className="pb-2 pr-4">Name</th>
                                <th className="pb-2 pr-4">Email</th>
                                <th className="pb-2">Voted At</th>
                              </tr>
                            </thead>
                            <tbody>
                              {option.voters.map(voter => (
                                <tr key={voter.member_id} className="border-b last:border-0">
                                  <td className="py-2 pr-4">{voter.first_name} {voter.last_name}</td>
                                  <td className="py-2 pr-4 text-gray-500">{voter.email}</td>
                                  <td className="py-2 text-gray-500">
                                    {new Date(voter.voted_at).toLocaleString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  ))}
                  {question.options.every(o => o.voters.length === 0) && (
                    <p className="text-gray-500 text-sm">No votes yet.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
