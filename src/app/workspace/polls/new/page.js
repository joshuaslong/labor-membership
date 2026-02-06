'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ChapterSelect from '@/components/ChapterSelect'

export default function CreatePollPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [chapters, setChapters] = useState([])
  const [groups, setGroups] = useState([])

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    target_type: 'chapter',
    chapter_id: '',
    group_id: '',
    results_visibility: 'after_voting',
    closes_at: '',
    status: 'draft',
    questions: [
      {
        question_text: '',
        options: [{ option_text: '' }, { option_text: '' }],
      },
    ],
  })

  useEffect(() => {
    loadChapters()
  }, [])

  const loadChapters = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setLoading(false)
      return
    }

    // Get team member info
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('*, chapters(id, name, level)')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    if (!teamMember) {
      setLoading(false)
      return
    }

    const roles = teamMember.roles || []
    const isNationalAdmin = roles.includes('super_admin') || roles.includes('national_admin')

    // Load chapters based on role
    if (isNationalAdmin) {
      const { data: allChapters } = await supabase
        .from('chapters')
        .select('id, name, level')
        .order('name')

      setChapters(allChapters || [])
    } else if (teamMember.chapter_id) {
      const { data: descendants } = await supabase
        .rpc('get_chapter_descendants', { chapter_uuid: teamMember.chapter_id })

      const chapterIds = [teamMember.chapter_id, ...(descendants?.map(d => d.id) || [])]

      const { data: accessibleChapters } = await supabase
        .from('chapters')
        .select('id, name, level')
        .in('id', chapterIds)
        .order('name')

      setChapters(accessibleChapters || [])

      // Default to user's chapter
      if (teamMember.chapter_id && !formData.chapter_id) {
        setFormData(prev => ({ ...prev, chapter_id: teamMember.chapter_id }))
      }
    }

    setLoading(false)
  }

  const fetchGroups = async (chapterId) => {
    if (!chapterId) {
      setGroups([])
      return
    }
    try {
      const res = await fetch(`/api/admin/groups?chapterId=${chapterId}`)
      const data = await res.json()
      setGroups(data.groups || [])
    } catch {
      setGroups([])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        target_type: formData.target_type,
        chapter_id: formData.chapter_id,
        group_id: formData.target_type === 'group' ? formData.group_id : null,
        results_visibility: formData.results_visibility,
        opens_at: null,
        closes_at: formData.closes_at || null,
        status: formData.status,
        questions: formData.questions.map((q, qi) => ({
          question_text: q.question_text,
          display_order: qi,
          options: q.options.map((o, oi) => ({
            option_text: o.option_text,
            display_order: oi,
          })),
        })),
      }

      const res = await fetch('/api/admin/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      router.push('/workspace/polls')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Question/option management
  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
        { question_text: '', options: [{ option_text: '' }, { option_text: '' }] },
      ],
    }))
  }

  const removeQuestion = (qi) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== qi),
    }))
  }

  const updateQuestion = (qi, text) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === qi ? { ...q, question_text: text } : q
      ),
    }))
  }

  const addOption = (qi) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === qi ? { ...q, options: [...q.options, { option_text: '' }] } : q
      ),
    }))
  }

  const removeOption = (qi, oi) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === qi ? { ...q, options: q.options.filter((_, j) => j !== oi) } : q
      ),
    }))
  }

  const updateOption = (qi, oi, text) => {
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.map((q, i) =>
        i === qi
          ? {
              ...q,
              options: q.options.map((o, j) =>
                j === oi ? { ...o, option_text: text } : o
              ),
            }
          : q
      ),
    }))
  }

  const isFormValid = () => {
    if (!formData.title.trim() || !formData.chapter_id) return false
    if (formData.target_type === 'group' && !formData.group_id) return false
    if (formData.questions.length === 0) return false
    for (const q of formData.questions) {
      if (!q.question_text.trim()) return false
      if (q.options.length < 2) return false
      for (const o of q.options) {
        if (!o.option_text.trim()) return false
      }
    }
    return true
  }

  const inputClass = "w-full px-3 py-2 text-sm border border-stone-200 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
  const labelClass = "block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Create Poll</h1>
        </div>
        <div className="bg-white border border-stone-200 rounded p-8 text-center text-gray-500">
          Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Create Poll</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main content - 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Poll Details */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Poll Details</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className={labelClass}>Poll Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className={inputClass}
                    placeholder="e.g., Q1 Priorities Vote"
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className={`${inputClass} min-h-20`}
                    placeholder="Optional description for members..."
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Questions */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Questions</h2>
                <button
                  type="button"
                  onClick={addQuestion}
                  className="text-sm text-labor-red hover:underline"
                >
                  + Add Question
                </button>
              </div>
              <div className="p-4 space-y-6">
                {formData.questions.map((q, qi) => (
                  <div key={qi} className="border border-stone-200 rounded p-4 bg-stone-50">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-xs font-medium text-gray-500 uppercase mt-2">Q{qi + 1}</span>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={q.question_text}
                          onChange={(e) => updateQuestion(qi, e.target.value)}
                          required
                          className={inputClass}
                          placeholder="What should our top priority be?"
                        />
                      </div>
                      {formData.questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeQuestion(qi)}
                          className="text-red-500 hover:text-red-700 text-sm mt-2"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="ml-8 space-y-2">
                      {q.options.map((o, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-4">{oi + 1}.</span>
                          <input
                            type="text"
                            value={o.option_text}
                            onChange={(e) => updateOption(qi, oi, e.target.value)}
                            required
                            className={`${inputClass} flex-1`}
                            placeholder={`Option ${oi + 1}`}
                          />
                          {q.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOption(qi, oi)}
                              className="text-red-400 hover:text-red-600 text-xs"
                            >
                              x
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addOption(qi)}
                        className="text-sm text-gray-500 hover:text-labor-red ml-6"
                      >
                        + Add Option
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar - 1/3 */}
          <div className="space-y-6">
            {/* Target */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Target Audience</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="chapter"
                      checked={formData.target_type === 'chapter'}
                      onChange={() => {
                        setFormData(prev => ({ ...prev, target_type: 'chapter', group_id: '' }))
                        setGroups([])
                      }}
                      className="text-labor-red focus:ring-labor-red"
                    />
                    <span className="text-sm">Chapter</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      value="group"
                      checked={formData.target_type === 'group'}
                      onChange={() => {
                        setFormData(prev => ({ ...prev, target_type: 'group' }))
                        if (formData.chapter_id) fetchGroups(formData.chapter_id)
                      }}
                      className="text-labor-red focus:ring-labor-red"
                    />
                    <span className="text-sm">Group</span>
                  </label>
                </div>

                <ChapterSelect
                  chapters={chapters}
                  value={formData.chapter_id}
                  onChange={(id) => {
                    setFormData(prev => ({ ...prev, chapter_id: id, group_id: '' }))
                    if (formData.target_type === 'group') {
                      fetchGroups(id)
                    }
                  }}
                  required
                />

                {formData.target_type === 'group' && (
                  <select
                    value={formData.group_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, group_id: e.target.value }))}
                    className={inputClass}
                    required
                  >
                    <option value="">Select Group</option>
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.member_count} members)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Options */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Options</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className={labelClass}>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Draft polls are only visible to admins. Active polls are open for voting.
                  </p>
                </div>

                <div>
                  <label className={labelClass}>Results Visibility</label>
                  <select
                    value={formData.results_visibility}
                    onChange={(e) => setFormData(prev => ({ ...prev, results_visibility: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="after_voting">Show after voting</option>
                    <option value="after_close">Show after poll closes</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Closes At (optional)</label>
                  <input
                    type="datetime-local"
                    value={formData.closes_at}
                    onChange={(e) => setFormData(prev => ({ ...prev, closes_at: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={saving || !isFormValid()}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-labor-red rounded hover:bg-labor-red/90 disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Create Poll'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/workspace/polls')}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
