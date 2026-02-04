'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function MemberPollVotePage() {
  const params = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [selections, setSelections] = useState({}) // { question_id: option_id }
  const [submitted, setSubmitted] = useState(false)
  const [voteResults, setVoteResults] = useState(null)

  useEffect(() => {
    const fetchPoll = async () => {
      try {
        const res = await fetch(`/api/polls/${params.id}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error)
        setData(json)

        // If member already voted, pre-fill their selections
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
    // Validate all questions answered
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

      // Reload poll data to get updated state
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
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading poll...</p>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/dashboard/polls" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block">
          &larr; Back to Polls
        </Link>
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      </div>
    )
  }

  const { poll, questions, has_voted, results } = data
  const showResults = results !== null
  const resultsFromVote = voteResults || results

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/dashboard/polls" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block">
        &larr; Back to Polls
      </Link>

      {/* Poll header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl text-gray-900 mb-2">{poll.title}</h1>
        {poll.description && (
          <p className="text-gray-600 mb-2">{poll.description}</p>
        )}
        <div className="flex flex-wrap gap-x-4 text-sm text-gray-500">
          {poll.target_name && <span>{poll.target_name}</span>}
          {poll.closes_at && (
            <span>Closes: {new Date(poll.closes_at).toLocaleDateString()}</span>
          )}
          {poll.status === 'closed' && (
            <span className="text-blue-600">This poll is closed</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>
      )}

      {/* Success message after voting */}
      {submitted && (
        <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg">
          Your vote has been recorded. Thank you for participating!
        </div>
      )}

      {/* Voted status */}
      {has_voted && !submitted && (
        <div className="mb-6 p-4 bg-blue-50 text-blue-700 rounded-lg">
          You have already voted in this poll.
          {!showResults && poll.results_visibility === 'after_close' && poll.status !== 'closed' && (
            <span> Results will be available after this poll closes.</span>
          )}
        </div>
      )}

      {/* Voting form (not voted yet and poll is active) */}
      {!has_voted && !submitted && poll.status === 'active' && (
        <div className="space-y-6">
          {questions.map((question, qi) => (
            <div key={question.id} className="card">
              <h3 className="font-semibold text-gray-900 mb-4">
                Q{qi + 1}. {question.question_text}
              </h3>
              <div className="space-y-2">
                {question.options.map(option => (
                  <label
                    key={option.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selections[question.id] === option.id
                        ? 'border-labor-red bg-red-50'
                        : 'border-gray-200 hover:border-gray-300'
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
                    <span className="text-gray-700">{option.option_text}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <button
            onClick={handleVote}
            disabled={submitting || Object.keys(selections).length !== questions.length}
            className="btn-primary w-full"
          >
            {submitting ? 'Submitting...' : 'Submit Vote'}
          </button>
        </div>
      )}

      {/* Results view */}
      {(showResults || resultsFromVote) && (
        <div className="space-y-6">
          {resultsFromVote && (
            <p className="text-sm text-gray-500">
              {resultsFromVote.total_voters} total vote{resultsFromVote.total_voters !== 1 ? 's' : ''}
            </p>
          )}

          {(resultsFromVote?.questions || []).map((question, qi) => {
            const maxVotes = Math.max(...question.options.map(o => o.vote_count), 1)

            return (
              <div key={question.id} className="card">
                <h3 className="font-semibold text-gray-900 mb-4">
                  Q{qi + 1}. {question.question_text}
                </h3>

                <div className="space-y-3">
                  {question.options.map(option => {
                    const isMyChoice = selections[question.id] === option.id

                    return (
                      <div key={option.id}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className={`${isMyChoice ? 'font-semibold text-labor-red' : 'text-gray-700'}`}>
                            {option.option_text}
                            {isMyChoice && ' (your vote)'}
                          </span>
                          <span className="text-gray-500">
                            {option.vote_count} ({option.percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-5">
                          <div
                            className={`rounded-full h-5 transition-all duration-300 ${isMyChoice ? 'bg-labor-red' : 'bg-gray-400'}`}
                            style={{ width: `${resultsFromVote.total_voters > 0 ? (option.vote_count / maxVotes) * 100 : 0}%`, minWidth: option.vote_count > 0 ? '8px' : '0' }}
                          ></div>
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
        <div className="space-y-6">
          {questions.map((question, qi) => (
            <div key={question.id} className="card">
              <h3 className="font-semibold text-gray-900 mb-3">
                Q{qi + 1}. {question.question_text}
              </h3>
              <div className="space-y-2">
                {question.options.map(option => {
                  const isMyChoice = selections[question.id] === option.id
                  return (
                    <div
                      key={option.id}
                      className={`p-3 rounded-lg border ${
                        isMyChoice ? 'border-labor-red bg-red-50' : 'border-gray-100'
                      }`}
                    >
                      <span className={isMyChoice ? 'font-semibold text-labor-red' : 'text-gray-500'}>
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
