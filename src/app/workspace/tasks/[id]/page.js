'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const STATUSES = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'DONE', label: 'Done' },
]

const PRIORITIES = [
  { value: 'P1', label: 'P1 - Critical' },
  { value: 'P2', label: 'P2 - High' },
  { value: 'P3', label: 'P3 - Standard' },
]

const SKILL_TYPES = [
  { value: '', label: 'None' },
  { value: 'WRITING', label: 'Writing' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'RESEARCH', label: 'Research' },
  { value: 'COORDINATION', label: 'Coordination' },
]

const statusColors = {
  NOT_STARTED: 'text-gray-700 bg-stone-50 border-stone-200',
  IN_PROGRESS: 'text-blue-700 bg-blue-50 border-blue-200',
  BLOCKED: 'text-red-700 bg-red-50 border-red-200',
  IN_REVIEW: 'text-amber-700 bg-amber-50 border-amber-200',
  DONE: 'text-green-700 bg-green-50 border-green-200',
}

const priorityColors = {
  P1: 'text-red-700 bg-red-50 border-red-200',
  P2: 'text-amber-700 bg-amber-50 border-amber-200',
  P3: 'text-gray-700 bg-stone-50 border-stone-200',
}

const skillColors = {
  WRITING: 'text-purple-700 bg-purple-50 border-purple-200',
  DESIGN: 'text-pink-700 bg-pink-50 border-pink-200',
  VIDEO: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  TECHNICAL: 'text-cyan-700 bg-cyan-50 border-cyan-200',
  RESEARCH: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  COORDINATION: 'text-orange-700 bg-orange-50 border-orange-200',
}

export default function TaskDetailPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [teamMembers, setTeamMembers] = useState([])
  const [volunteers, setVolunteers] = useState([])

  const [formData, setFormData] = useState({})

  useEffect(() => {
    loadTask()
    loadTeamMembers()
    loadVolunteers()
  }, [id])

  const loadTask = async () => {
    try {
      const res = await fetch(`/api/tasks/${id}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to load task')

      setTask(data.task)
      // Determine assignTo value from owner or assignee
      let assignTo = ''
      if (data.task.owner?.id) assignTo = `tm:${data.task.owner.id}`
      else if (data.task.assignee?.id) assignTo = `vol:${data.task.assignee.id}`

      setFormData({
        name: data.task.name || '',
        project: data.task.project || '',
        phase: data.task.phase || '',
        assignTo,
        deliverable: data.task.deliverable || '',
        time_estimate_min: data.task.time_estimate_min || '',
        deadline: data.task.deadline || '',
        priority: data.task.priority || 'P3',
        status: data.task.status || 'NOT_STARTED',
        skill_type: data.task.skill_type || '',
        notes: data.task.notes || '',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadTeamMembers = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('team_members')
      .select('id, user_id, member:members(first_name, last_name)')
      .order('created_at')

    // For team members without member_id linked, look up by user_id
    const needsLookup = (data || []).filter(tm => !tm.member && tm.user_id)
    if (needsLookup.length > 0) {
      const userIds = needsLookup.map(tm => tm.user_id)
      const { data: members } = await supabase
        .from('members')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds)

      const memberByUserId = {}
      for (const m of (members || [])) {
        memberByUserId[m.user_id] = { first_name: m.first_name, last_name: m.last_name }
      }

      for (const tm of data) {
        if (!tm.member && memberByUserId[tm.user_id]) {
          tm.member = memberByUserId[tm.user_id]
        }
      }
    }

    setTeamMembers(data || [])
  }

  const loadVolunteers = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('members')
      .select('id, first_name, last_name')
      .eq('wants_to_volunteer', true)
      .eq('status', 'active')
      .order('first_name')

    setVolunteers(data || [])
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleStatusChange = async (newStatus) => {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setTask(prev => ({ ...prev, status: newStatus }))
      setFormData(prev => ({ ...prev, status: newStatus }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Parse assignTo value
      let owner = null
      let assignee_member_id = null
      if (formData.assignTo) {
        const [type, assignId] = formData.assignTo.split(':')
        if (type === 'tm') owner = assignId
        else if (type === 'vol') assignee_member_id = assignId
      }

      const { assignTo, ...rest } = formData
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rest,
          owner,
          assignee_member_id,
          skill_type: formData.skill_type || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSuccess('Task updated')
      setEditing(false)
      loadTask()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this task? This cannot be undone.')) return

    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      router.push('/workspace/tasks')
    } catch (err) {
      setError(err.message)
    }
  }

  function formatTime(min) {
    if (!min) return 'N/A'
    const h = Math.floor(min / 60)
    const m = min % 60
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function isOverdue() {
    if (!task?.deadline || task?.status === 'DONE') return false
    return new Date(task.deadline + 'T23:59:59') < new Date()
  }

  const inputClass = "w-full px-3 py-2 text-sm border border-stone-200 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
  const labelClass = "block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-labor-red"></div>
        </div>
      </div>
    )
  }

  if (error && !task) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white border border-stone-200 rounded p-6 text-center">
          <p className="text-sm text-red-600 mb-2">{error}</p>
          <Link href="/workspace/tasks" className="text-sm text-labor-red hover:underline">
            Back to tasks
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
          <Link href="/workspace/tasks" className="hover:text-gray-600">Tasks</Link>
          <span>/</span>
          <span className="text-gray-600">{task.project}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{task.name}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusColors[task.status]}`}>
                {task.status.replace(/_/g, ' ')}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${priorityColors[task.priority]}`}>
                {task.priority}
              </span>
              {task.skill_type && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${skillColors[task.skill_type] || 'text-gray-700 bg-stone-50 border-stone-200'}`}>
                  {task.skill_type}
                </span>
              )}
              {isOverdue() && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border text-red-700 bg-red-50 border-red-200">
                  Overdue
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50 transition-colors"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={() => { setEditing(false); loadTask() }}
                  className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-labor-red rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {error && task && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4 text-sm">
          {success}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Status Change */}
          {!editing && task.status !== 'DONE' && (
            <div className="bg-white border border-stone-200 rounded p-4">
              <label className={labelClass}>Update Status</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {STATUSES.filter(s => s.value !== task.status).map(s => (
                  <button
                    key={s.value}
                    onClick={() => handleStatusChange(s.value)}
                    disabled={saving}
                    className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors hover:opacity-80 disabled:opacity-50 ${statusColors[s.value]}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Deliverable */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">Deliverable</h2>
            </div>
            <div className="p-4">
              {editing ? (
                <textarea
                  name="deliverable"
                  value={formData.deliverable}
                  onChange={handleChange}
                  className={`${inputClass} min-h-20`}
                  rows={3}
                />
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.deliverable}</p>
              )}
            </div>
          </div>

          {/* Details (edit mode) */}
          {editing && (
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Task Details</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className={labelClass}>Task Name</label>
                  <input type="text" name="name" value={formData.name} onChange={handleChange} className={inputClass} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Project</label>
                    <input type="text" name="project" value={formData.project} onChange={handleChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Phase</label>
                    <input type="text" name="phase" value={formData.phase} onChange={handleChange} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Priority</label>
                    <select name="priority" value={formData.priority} onChange={handleChange} className={inputClass}>
                      {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Status</label>
                    <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
                      {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Deadline</label>
                    <input type="date" name="deadline" value={formData.deadline} onChange={handleChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Time Estimate (min)</label>
                    <input type="number" name="time_estimate_min" value={formData.time_estimate_min} onChange={handleChange} className={inputClass} min="1" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Assign To</label>
                    <select name="assignTo" value={formData.assignTo} onChange={handleChange} className={inputClass}>
                      <option value="">Unassigned</option>
                      <optgroup label="Team Members">
                        {teamMembers.map(tm => (
                          <option key={`tm-${tm.id}`} value={`tm:${tm.id}`}>
                            {tm.member ? `${tm.member.first_name} ${tm.member.last_name}` : 'Unknown'}
                          </option>
                        ))}
                      </optgroup>
                      {volunteers.length > 0 && (
                        <optgroup label="Volunteers">
                          {volunteers.map(v => (
                            <option key={`vol-${v.id}`} value={`vol:${v.id}`}>
                              {v.first_name} {v.last_name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Skill Type</label>
                    <select name="skill_type" value={formData.skill_type} onChange={handleChange} className={inputClass}>
                      {SKILL_TYPES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">Notes</h2>
            </div>
            <div className="p-4">
              {editing ? (
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  className={`${inputClass} min-h-16`}
                  rows={3}
                  placeholder="Block reasons, feedback, context..."
                />
              ) : (
                <p className="text-sm text-gray-600 whitespace-pre-wrap">
                  {task.notes || <span className="text-gray-400 italic">No notes</span>}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">Details</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Assigned To</span>
                <span className="text-sm text-gray-900 text-right">
                  {task.owner?.member
                    ? `${task.owner.member.first_name} ${task.owner.member.last_name}`
                    : task.assignee
                      ? <>{task.assignee.first_name} {task.assignee.last_name} <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-50 text-teal-700 ml-1">Vol</span></>
                      : 'Unassigned'}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Deadline</span>
                <span className={`text-sm text-right ${isOverdue() ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                  {formatDate(task.deadline)}
                </span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Estimate</span>
                <span className="text-sm text-gray-900">{formatTime(task.time_estimate_min)}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="text-xs text-gray-500 uppercase tracking-wide">Project</span>
                <span className="text-sm text-gray-900 text-right">{task.project}</span>
              </div>
              {task.phase && (
                <div className="flex justify-between items-start">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Phase</span>
                  <span className="text-sm text-gray-900">{task.phase}</span>
                </div>
              )}
              <div className="border-t border-stone-100 pt-3 mt-3">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Created By</span>
                  <span className="text-sm text-gray-600 text-right">
                    {task.creator?.member ? `${task.creator.member.first_name} ${task.creator.member.last_name}` : 'Unknown'}
                  </span>
                </div>
                <div className="flex justify-between items-start mt-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Created</span>
                  <span className="text-sm text-gray-600">
                    {new Date(task.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">Actions</h2>
            </div>
            <div className="p-4">
              <button
                onClick={handleDelete}
                className="w-full px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50 transition-colors"
              >
                Delete Task
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
