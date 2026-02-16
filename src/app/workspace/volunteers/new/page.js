'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ChapterSelect from '@/components/ChapterSelect'

const SKILL_OPTIONS = [
  'Canvassing', 'Phone Banking', 'Data Entry', 'Social Media',
  'Graphic Design', 'Event Planning', 'Translation', 'Legal',
  'Writing', 'Photography', 'Video', 'Web Development',
  'Fundraising', 'Community Organizing', 'Public Speaking', 'Other'
]

export default function CreateVolunteerOpportunityPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [chapters, setChapters] = useState([])

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    opportunity_type: 'one_time',
    chapter_id: '',
    event_date: '',
    start_time: '',
    end_time: '',
    location_name: '',
    is_remote: false,
    skills_needed: [],
    spots_available: '',
    time_commitment: '',
    deadline: '',
    status: 'draft',
  })

  useEffect(() => {
    loadChapters()
  }, [])

  const loadChapters = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: teamMember } = await supabase
      .from('team_members')
      .select('id, roles, chapter_id, is_media_team')
      .eq('user_id', user.id)
      .eq('active', true)
      .single()

    let admin = null
    if (teamMember && teamMember.roles?.length) {
      const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
      const highestRole = roleHierarchy.find(r => teamMember.roles.includes(r)) || teamMember.roles[0]
      admin = { id: teamMember.id, role: highestRole, chapter_id: teamMember.chapter_id }
    }

    if (['super_admin', 'national_admin'].includes(admin?.role)) {
      const { data: allChapters } = await supabase
        .from('chapters')
        .select('id, name, level')
        .order('name')
      setChapters(allChapters || [])
    } else if (admin?.chapter_id) {
      const { data: descendants } = await supabase
        .rpc('get_chapter_descendants', { chapter_uuid: admin.chapter_id })

      const chapterIds = [admin.chapter_id, ...(descendants?.map(d => d.id) || [])]

      const { data: accessibleChapters } = await supabase
        .from('chapters')
        .select('id, name, level')
        .in('id', chapterIds)
        .order('name')

      setChapters(accessibleChapters || [])

      if (admin.chapter_id && !formData.chapter_id) {
        setFormData(prev => ({ ...prev, chapter_id: admin.chapter_id }))
      }
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const toggleSkill = (skill) => {
    setFormData(prev => ({
      ...prev,
      skills_needed: prev.skills_needed.includes(skill)
        ? prev.skills_needed.filter(s => s !== skill)
        : [...prev.skills_needed, skill]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload = {
        ...formData,
        spots_available: formData.spots_available ? parseInt(formData.spots_available) : null,
        event_date: formData.opportunity_type === 'one_time' ? formData.event_date || null : null,
        start_time: formData.opportunity_type === 'one_time' ? formData.start_time || null : null,
        end_time: formData.opportunity_type === 'one_time' ? formData.end_time || null : null,
        deadline: formData.deadline || null,
      }

      const res = await fetch('/api/volunteers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create opportunity')
      }

      router.push('/workspace/volunteers')
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
      <div className="mb-6">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Create Volunteer Opportunity</h1>
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
            {/* Details */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Details</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className={labelClass}>Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="e.g., Door-to-Door Canvassing"
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Description *</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className={`${inputClass} min-h-24`}
                    placeholder="Describe the opportunity, what volunteers will do, and any requirements..."
                    rows={5}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Type */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Opportunity Type</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="opportunity_type"
                      value="one_time"
                      checked={formData.opportunity_type === 'one_time'}
                      onChange={handleChange}
                      className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
                    />
                    <span className="text-sm text-gray-700">One-time Event</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="opportunity_type"
                      value="ongoing"
                      checked={formData.opportunity_type === 'ongoing'}
                      onChange={handleChange}
                      className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
                    />
                    <span className="text-sm text-gray-700">Ongoing Role</span>
                  </label>
                </div>

                {formData.opportunity_type === 'one_time' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className={labelClass}>Event Date *</label>
                      <input
                        type="date"
                        name="event_date"
                        value={formData.event_date}
                        onChange={handleChange}
                        className={inputClass}
                        required={formData.opportunity_type === 'one_time'}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Start Time</label>
                      <input
                        type="time"
                        name="start_time"
                        value={formData.start_time}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>End Time</label>
                      <input
                        type="time"
                        name="end_time"
                        value={formData.end_time}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Location */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Location</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_remote"
                    name="is_remote"
                    checked={formData.is_remote}
                    onChange={handleChange}
                    className="w-4 h-4 text-labor-red border-gray-300 rounded focus:ring-labor-red"
                  />
                  <label htmlFor="is_remote" className="text-sm text-gray-700">This is a remote opportunity</label>
                </div>
                {!formData.is_remote && (
                  <div>
                    <label className={labelClass}>Location Name</label>
                    <input
                      type="text"
                      name="location_name"
                      value={formData.location_name}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="e.g., Campaign HQ, City Hall"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Skills */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Skills Needed</h2>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SKILL_OPTIONS.map(skill => (
                    <label key={skill} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.skills_needed.includes(skill)}
                        onChange={() => toggleSkill(skill)}
                        className="w-4 h-4 text-labor-red border-gray-300 rounded focus:ring-labor-red"
                      />
                      <span className="text-sm text-gray-700">{skill}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - 1/3 */}
          <div className="space-y-6">
            {/* Chapter */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Chapter</h2>
              </div>
              <div className="p-4">
                <ChapterSelect
                  chapters={chapters}
                  value={formData.chapter_id}
                  onChange={(value) => setFormData(prev => ({ ...prev, chapter_id: value }))}
                  required
                />
              </div>
            </div>

            {/* Capacity & Deadline */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Capacity</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className={labelClass}>Spots Available</label>
                  <input
                    type="number"
                    name="spots_available"
                    value={formData.spots_available}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Unlimited"
                    min="1"
                  />
                </div>
                <div>
                  <label className={labelClass}>Time Commitment</label>
                  <input
                    type="text"
                    name="time_commitment"
                    value={formData.time_commitment}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="e.g., 2-3 hours/week"
                  />
                </div>
                <div>
                  <label className={labelClass}>Application Deadline</label>
                  <input
                    type="date"
                    name="deadline"
                    value={formData.deadline}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Status</h2>
              </div>
              <div className="p-4">
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Draft opportunities are only visible to admins.
                </p>
              </div>
            </div>

            {/* Submit */}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-labor-red rounded hover:bg-labor-red/90 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Opportunity'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/workspace/volunteers')}
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
