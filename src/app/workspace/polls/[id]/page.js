'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function WorkspacePollDetailPage() {
  const params = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [selections, setSelections] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [voteResults, setVoteResults] = useState(null)

  useEffect(() => {
    const fetchPoll = async () => {
      try {
        const res = await fetch(`/api/polls/${params.id}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        setData(json)

        // Pre-fill selections if already voted
        if (json.my_responses) {
          const sels = {}
          json.my_responses.forEach(r => {
            sels[r.question_id] = r.option_id
          })
          setSelections(sels)
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchPoll()
  }, [params.id])

  const handleVote = async () => {
    const unanswered = data.questions.filter(q => !selections[q.id])
    if (unanswered.length > 0) {
      setError('Please answer all questions before submitting.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const responses = Object.entries(selections).map(([question_id, option_id]) => ({
        question_id,
        option_id,
      }))

      const res = await fetch(`/api/polls/${params.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error)

      setSubmitted(true)
      if (json.results) {
        setVoteResults(json.results)
      }

      // Reload poll data
      const pollRes = await fetch(`/api/polls/${params.id}`)
      const pollJson = await pollRes.json()
      if (pollRes.ok) {
        setData(pollJson)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4">
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Poll</h1>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-8 text-center text-gray-500">
          Loading poll...
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <Link href="/workspace/polls" className="text-xs text-gray-500 hover:text-gray-700 mb-4 inline-block">
          &larr; Back to Polls
        </Link>
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      </div>
    )
  }

  const { poll, questions, has_voted, results } = data
  const showResults = results !== null
  const resultsFromVote = voteResults || results

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <Link href="/workspace/polls" className="text-xs text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Polls
      </Link>

      {/* Poll Header */}
      <div className="bg-white border border-stone-200 rounded-lg p-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 mb-1">{poll.title}</h1>
            {poll.description && (
              <p className="text-sm text-gray-600 mb-2">{poll.description}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              {poll.target_name && <span>{poll.target_name}</span>}
              <span>{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
              {poll.closes_at && (
                <span>Closes {new Date(poll.closes_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              )}
            </div>
          </div>
          <div>
            {has_voted ? (
              <span className="px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-full">
                Voted
              </span>
            ) : poll.status === 'active' ? (
              <span className="px-2.5 py-1 text-xs font-medium bg-labor-red-50 text-labor-red rounded-full">
                Active
              </span>
            ) : (
              <span className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
                Closed
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Success message */}
      {submitted && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          Your vote has been recorded. Thank you for participating!
        </div>
      )}

      {/* Already voted notice */}
      {has_voted && !submitted && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">
          You have already voted in this poll.
          {!showResults && poll.results_visibility === 'after_close' && poll.status !== 'closed' && (
            <span> Results will be available after this poll closes.</span>
          )}
        </div>
      )}

      {/* Voting Form */}
      {!has_voted && !submitted && poll.status === 'active' && (
        <div className="space-y-4">
          {questions.map((question, qi) => (
            <div key={question.id} className="bg-white border border-stone-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Q{qi + 1}. {question.question_text}
              </h3>
              <div className="space-y-2">
                {question.options.map(option => (
                  <label
                    key={option.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selections[question.id] === option.id
                        ? 'border-labor-red bg-labor-red-50'
                        : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={option.id}
                      checked={selections[question.id] === option.id}
                      onChange={() => setSelections(prev => ({ ...prev, [question.id]: option.id }))}
                      className="text-labor-red focus:ring-labor-red"
                    />
                    <span className="text-sm text-gray-700">{option.option_text}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={handleVote}
            disabled={submitting || Object.keys(selections).length !== questions.length}
            className="btn-primary w-full py-3"
          >
            {submitting ? 'Submitting...' : 'Submit Vote'}
          </button>
        </div>
      )}

      {/* Results View */}
      {(showResults || resultsFromVote) && (
        <div className="space-y-4">
          {resultsFromVote && (
            <p className="text-xs text-gray-500">
              {resultsFromVote.total_voters} total vote{resultsFromVote.total_voters !== 1 ? 's' : ''}
            </p>
          )}

          {(resultsFromVote?.questions || []).map((question, qi) => {
            const maxVotes = Math.max(...question.options.map(o => o.vote_count), 1)

            return (
              <div key={question.id} className="bg-white border border-stone-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Q{qi + 1}. {question.question_text}
                </h3>

                <div className="space-y-3">
                  {question.options.map(option => {
                    const isMyChoice = selections[question.id] === option.id
                    const barWidth = resultsFromVote.total_voters > 0
                      ? (option.vote_count / maxVotes) * 100
                      : 0

                    return (
                      <div key={option.id}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className={isMyChoice ? 'font-semibold text-labor-red' : 'text-gray-700'}>
                            {option.option_text}
                            {isMyChoice && ' (your vote)'}
                          </span>
                          <span className="text-gray-500 tabular-nums">
                            {option.vote_count} ({option.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-stone-100 rounded-full h-4">
                          <div
                            className={`rounded-full h-4 transition-all duration-300 ${isMyChoice ? 'bg-labor-red' : 'bg-stone-400'}`}
                            style={{ width: `${barWidth}%`, minWidth: option.vote_count > 0 ? '8px' : '0' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Voted but results hidden */}
      {has_voted && !showResults && !resultsFromVote && (
        <div className="space-y-4">
          {questions.map((question, qi) => (
            <div key={question.id} className="bg-white border border-stone-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Q{qi + 1}. {question.question_text}
              </h3>
              <div className="space-y-2">
                {question.options.map(option => {
                  const isMyChoice = selections[question.id] === option.id
                  return (
                    <div
                      key={option.id}
                      className={`p-3 rounded-lg border ${
                        isMyChoice ? 'border-labor-red bg-labor-red-50' : 'border-stone-100 bg-stone-50'
                      }`}
                    >
                      <span className={`text-sm ${isMyChoice ? 'font-semibold text-labor-red' : 'text-gray-500'}`}>
                        {option.option_text}
                        {isMyChoice && ' (your vote)'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
