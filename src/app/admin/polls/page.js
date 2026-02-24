'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ChapterSelect from '@/components/ChapterSelect'

const STATUS_LABELS = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  active: { label: 'Active', className: 'bg-green-50 text-green-700' },
  closed: { label: 'Closed', className: 'bg-blue-50 text-blue-700' },
  archived: { label: 'Archived', className: 'bg-gray-100 text-gray-500' },
}

export default function AdminPollsPage() {
  const [adminInfo, setAdminInfo] = useState(null)
  const [chapters, setChapters] = useState([])
  const [groups, setGroups] = useState([])
  const [polls, setPolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [pollsLoading, setPollsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingPoll, setEditingPoll] = useState(null)
  const [saving, setSaving] = useState(false)
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

  // Load admin info and chapters
  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data: teamMember } = await supabase
        .from('team_members')
        .select('id, roles, chapter_id, is_media_team')
        .eq('user_id', user.id)
        .eq('active', true)
        .single()

      if (!teamMember || !teamMember.roles?.length) {
        setLoading(false)
        return
      }

      const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
      const highestRole = roleHierarchy.find(r => teamMember.roles.includes(r)) || teamMember.roles[0]
      const admin = { id: teamMember.id, role: highestRole, chapter_id: teamMember.chapter_id }

      setAdminInfo(admin)

      // Load accessible chapters
      if (['super_admin', 'national_admin'].includes(admin.role)) {
        const { data: allChapters } = await supabase
          .from('chapters')
          .select('id, name, level')
          .order('name')
        setChapters(allChapters || [])
      } else if (admin.chapter_id) {
        const { data: descendants } = await supabase
          .rpc('get_chapter_descendants', { chapter_uuid: admin.chapter_id })
        const chapterIds = [admin.chapter_id, ...(descendants?.map(d => d.id) || [])]
        const { data: accessibleChapters } = await supabase
          .from('chapters')
          .select('id, name, level')
          .in('id', chapterIds)
          .order('name')
        setChapters(accessibleChapters || [])
      }

      setLoading(false)
    }

    loadData()
  }, [])

  // Fetch polls
  useEffect(() => {
    if (!adminInfo) return
    fetchPolls()
  }, [adminInfo, statusFilter])

  const fetchPolls = async () => {
    setPollsLoading(true)
    setError(null)
    try {
      let url = '/api/admin/polls'
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (params.toString()) url += `?${params.toString()}`

      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPolls(data.polls || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setPollsLoading(false)
    }
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

  // Form handlers
  const resetForm = () => {
    setFormData({
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
    setEditingPoll(null)
    setShowForm(false)
    setGroups([])
  }

  const handleEdit = async (poll) => {
    // Fetch full poll detail
    try {
      const res = await fetch(`/api/admin/polls/${poll.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setFormData({
        title: data.poll.title,
        description: data.poll.description || '',
        target_type: data.poll.target_type,
        chapter_id: data.poll.chapter_id,
        group_id: data.poll.group_id || '',
        results_visibility: data.poll.results_visibility,
        closes_at: data.poll.closes_at ? data.poll.closes_at.slice(0, 16) : '',
        status: data.poll.status,
        questions: data.questions.map(q => ({
          question_text: q.question_text,
          options: q.options.map(o => ({ option_text: o.option_text })),
        })),
      })

      if (data.poll.target_type === 'group') {
        await fetchGroups(data.poll.chapter_id)
      }

      setEditingPoll(data.poll)
      setShowForm(true)
    } catch (err) {
      alert(`Failed to load poll: ${err.message}`)
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

      const url = editingPoll
        ? `/api/admin/polls/${editingPoll.id}`
        : '/api/admin/polls'

      const res = await fetch(url, {
        method: editingPoll ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      resetForm()
      fetchPolls()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (poll) => {
    if (!confirm(`Delete poll "${poll.title}"? This cannot be undone.`)) return

    try {
      const res = await fetch(`/api/admin/polls/${poll.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      fetchPolls()
    } catch (err) {
      alert(`Failed to delete: ${err.message}`)
    }
  }

  const handleStatusChange = async (poll, newStatus) => {
    const confirmMsg = newStatus === 'active'
      ? `Activate poll "${poll.title}"? It will become visible to targeted members.`
      : newStatus === 'closed'
        ? `Close poll "${poll.title}"? No more votes will be accepted.`
        : `Archive poll "${poll.title}"?`

    if (!confirm(confirmMsg)) return

    try {
      const res = await fetch(`/api/admin/polls/${poll.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      fetchPolls()
    } catch (err) {
      alert(`Failed to update status: ${err.message}`)
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

  const isDraft = editingPoll?.status === 'draft' || !editingPoll

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header bar */}
      <div className="border-b border-stone-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Polls</h1>
            </div>
            {!showForm && (
              <button onClick={() => setShowForm(true)} className="btn-primary">
                New Poll
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <Link href="/admin" className="link-subtle text-sm mb-4 inline-block">
          &larr; Admin Dashboard
        </Link>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Create/Edit Form */}
        {showForm && (
          <div className="bg-white border border-stone-200 rounded p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-6">
              {editingPoll ? 'Edit Poll' : 'New Poll'}
            </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Target selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Target</label>
              <div className="flex gap-4 mb-3">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="chapter"
                    checked={formData.target_type === 'chapter'}
                    onChange={() => {
                      setFormData(prev => ({ ...prev, target_type: 'chapter', group_id: '' }))
                      setGroups([])
                    }}
                    disabled={editingPoll && !isDraft}
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
                    disabled={editingPoll && !isDraft}
                    className="text-labor-red focus:ring-labor-red"
                  />
                  <span className="text-sm">Chapter Group</span>
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
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
                </div>

                {formData.target_type === 'group' && (
                  <div>
                    <select
                      value={formData.group_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, group_id: e.target.value }))}
                      disabled={editingPoll && !isDraft}
                      className="input-field"
                      required
                    >
                      <option value="">Select Group</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.member_count} members)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Poll details */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
                className="input-field"
                placeholder="Q1 Priorities Vote"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="input-field"
                placeholder="Optional description for members..."
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Results Visibility</label>
                <select
                  value={formData.results_visibility}
                  onChange={(e) => setFormData(prev => ({ ...prev, results_visibility: e.target.value }))}
                  className="input-field"
                >
                  <option value="after_voting">Show after voting</option>
                  <option value="after_close">Show after poll closes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Closes At (optional)</label>
                <input
                  type="datetime-local"
                  value={formData.closes_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, closes_at: e.target.value }))}
                  className="input-field"
                />
              </div>
            </div>

            {/* Questions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">Questions</label>
                {isDraft && (
                  <button
                    type="button"
                    onClick={addQuestion}
                    className="text-sm text-labor-red hover:underline"
                  >
                    + Add Question
                  </button>
                )}
              </div>

              {!isDraft && (
                <p className="text-sm text-yellow-600 mb-3">
                  Questions cannot be edited after a poll becomes active.
                </p>
              )}

              <div className="space-y-6">
                {formData.questions.map((q, qi) => (
                  <div key={qi} className="border border-stone-200 rounded p-4 bg-stone-50">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-xs font-medium text-gray-500 uppercase mt-2">Q{qi + 1}</span>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={q.question_text}
                          onChange={(e) => updateQuestion(qi, e.target.value)}
                          disabled={!isDraft}
                          required
                          className="input-field"
                          placeholder="What should our top priority be?"
                        />
                      </div>
                      {isDraft && formData.questions.length > 1 && (
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
                            disabled={!isDraft}
                            required
                            className="input-field flex-1"
                            placeholder={`Option ${oi + 1}`}
                          />
                          {isDraft && q.options.length > 2 && (
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
                      {isDraft && (
                        <button
                          type="button"
                          onClick={() => addOption(qi)}
                          className="text-sm text-gray-500 hover:text-labor-red ml-6"
                        >
                          + Add Option
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-stone-200">
              <button
                type="submit"
                disabled={saving || !isFormValid()}
                className="btn-primary"
              >
                {saving ? 'Saving...' : (editingPoll ? 'Save Changes' : 'Create Poll')}
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancel
              </button>
            </div>
          </form>
          </div>
        )}

        {/* Status filter */}
        {!showForm && (
          <div className="mb-4 flex gap-2">
            {['', 'draft', 'active', 'closed', 'archived'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-sm rounded font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-labor-red text-white'
                    : 'bg-white text-gray-600 border border-stone-200 hover:bg-stone-50 hover:border-stone-300'
                }`}
              >
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
              </button>
            ))}
          </div>
        )}

        {/* Polls List */}
        {!showForm && (
          pollsLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-labor-red mx-auto"></div>
            </div>
          ) : polls.length === 0 ? (
            <div className="text-center py-12 bg-white border border-stone-200 rounded">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-1">No Polls</h3>
              <p className="text-gray-500 text-sm">Create your first poll to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {polls.map(poll => (
                <div key={poll.id} className="bg-white border border-stone-200 rounded p-4 hover:border-stone-300 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">{poll.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 border ${
                          poll.status === 'active' ? 'badge-success' :
                          poll.status === 'closed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          poll.status === 'archived' ? 'badge-neutral' :
                          'badge-neutral'
                        }`}>
                          {STATUS_LABELS[poll.status]?.label || poll.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>
                          {poll.target_type === 'group' ? `Group: ${poll.group_name}` : `${poll.chapter_name}`}
                        </span>
                        <span>{poll.question_count}Q</span>
                        {poll.status !== 'draft' && (
                          <span className="tabular-nums">{poll.response_count} votes</span>
                        )}
                        {poll.closes_at && (
                          <span>Closes {new Date(poll.closes_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {poll.status !== 'draft' && (
                        <Link
                          href={`/admin/polls/${poll.id}/results`}
                          className="px-3 py-1.5 text-sm bg-white text-gray-700 border border-stone-200 hover:bg-stone-50 hover:border-stone-300 rounded font-medium transition-colors"
                        >
                          Results
                        </Link>
                      )}
                      {poll.status === 'draft' && (
                        <>
                          <button
                            onClick={() => handleEdit(poll)}
                            className="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleStatusChange(poll, 'active')}
                            className="px-3 py-1.5 text-sm bg-labor-red text-white hover:bg-labor-red-600 rounded font-medium transition-colors"
                          >
                            Activate
                          </button>
                          <button
                            onClick={() => handleDelete(poll)}
                            className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 font-medium"
                          >
                            Delete
                          </button>
                        </>
                      )}
                      {poll.status === 'active' && (
                        <button
                          onClick={() => handleStatusChange(poll, 'closed')}
                          className="px-3 py-1.5 text-sm bg-white text-gray-700 border border-stone-200 hover:bg-stone-50 hover:border-stone-300 rounded font-medium transition-colors"
                        >
                          Close
                        </button>
                      )}
                      {poll.status === 'closed' && (
                        <button
                          onClick={() => handleStatusChange(poll, 'archived')}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-700 font-medium"
                        >
                          Archive
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
