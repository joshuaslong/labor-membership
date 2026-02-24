'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const PRIORITIES = [
  { value: 'P1', label: 'P1 - Critical', color: 'text-red-700' },
  { value: 'P2', label: 'P2 - High', color: 'text-amber-700' },
  { value: 'P3', label: 'P3 - Standard', color: 'text-gray-700' },
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

export default function CreateTaskPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [teamMembers, setTeamMembers] = useState([])
  const [volunteers, setVolunteers] = useState([])

  const [formData, setFormData] = useState({
    project: '',
    phase: '',
    name: '',
    assignTo: '',
    deliverable: '',
    time_estimate_min: '',
    deadline: '',
    priority: 'P3',
    skill_type: '',
    notes: '',
  })

  useEffect(() => {
    loadTeamMembers()
    loadVolunteers()
  }, [])

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Parse assignTo value: "tm:<id>" for team member, "vol:<id>" for volunteer
      let owner = null
      let assignee_member_id = null
      if (formData.assignTo) {
        const [type, id] = formData.assignTo.split(':')
        if (type === 'tm') owner = id
        else if (type === 'vol') assignee_member_id = id
      }

      const { assignTo, ...rest } = formData
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rest,
          owner,
          assignee_member_id,
          skill_type: formData.skill_type || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to create task')

      router.push('/workspace/tasks')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3 py-2 text-sm border border-stone-200 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
  const labelClass = "block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Create Task</h1>
        <Link href="/workspace/tasks" className="text-sm text-gray-500 hover:text-gray-700">
          Back to tasks
        </Link>
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
            {/* Task Details */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Task Details</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className={labelClass}>Task Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="e.g., Draft social media campaign for March"
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Deliverable *</label>
                  <textarea
                    name="deliverable"
                    value={formData.deliverable}
                    onChange={handleChange}
                    className={`${inputClass} min-h-20`}
                    placeholder="Describe the exact deliverable..."
                    rows={3}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Project / Initiative *</label>
                    <input
                      type="text"
                      name="project"
                      value={formData.project}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="e.g., Q1 Outreach Campaign"
                      required
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Phase</label>
                    <input
                      type="text"
                      name="phase"
                      value={formData.phase}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="e.g., Pre-production"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Notes</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    className={`${inputClass} min-h-16`}
                    placeholder="Additional context, block reasons, feedback..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - 1/3 */}
          <div className="space-y-6">
            {/* Assignment */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Assignment</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className={labelClass}>Assign To</label>
                  <select
                    name="assignTo"
                    value={formData.assignTo}
                    onChange={handleChange}
                    className={inputClass}
                  >
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
                  <select
                    name="skill_type"
                    value={formData.skill_type}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    {SKILL_TYPES.map(st => (
                      <option key={st.value} value={st.value}>{st.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Schedule</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className={labelClass}>Deadline *</label>
                  <input
                    type="date"
                    name="deadline"
                    value={formData.deadline}
                    onChange={handleChange}
                    className={inputClass}
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Time Estimate (minutes) *</label>
                  <input
                    type="number"
                    name="time_estimate_min"
                    value={formData.time_estimate_min}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="e.g., 120"
                    min="1"
                    required
                  />
                  {formData.time_estimate_min > 0 && (
                    <p className="text-xs text-gray-400 mt-1">
                      {Math.floor(formData.time_estimate_min / 60)}h {formData.time_estimate_min % 60}m
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Priority *</label>
                  <div className="flex gap-2">
                    {PRIORITIES.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, priority: p.value }))}
                        className={`flex-1 px-3 py-1.5 text-sm rounded transition-colors ${
                          formData.priority === p.value
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-50 text-gray-700 border border-stone-200 hover:bg-gray-100'
                        }`}
                      >
                        {p.value}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-labor-red rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Creating...' : 'Create Task'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/workspace/tasks')}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50 transition-colors"
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
