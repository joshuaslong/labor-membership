'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

const SKILL_OPTIONS = [
  'Canvassing', 'Phone Banking', 'Data Entry', 'Social Media',
  'Graphic Design', 'Event Planning', 'Translation', 'Legal',
  'Writing', 'Photography', 'Video', 'Web Development',
  'Fundraising', 'Community Organizing', 'Public Speaking', 'Other'
]

export default function EditVolunteerOpportunityPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    opportunity_type: 'one_time',
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

  // Applications state
  const [applications, setApplications] = useState([])
  const [loadingApps, setLoadingApps] = useState(true)
  const [reviewingId, setReviewingId] = useState(null)
  const [adminNotes, setAdminNotes] = useState('')

  useEffect(() => {
    loadOpportunity()
  }, [id])

  const loadOpportunity = async () => {
    try {
      const res = await fetch(`/api/volunteers/${id}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load opportunity')
      }

      const opp = data.opportunity
      setFormData({
        title: opp.title || '',
        description: opp.description || '',
        opportunity_type: opp.opportunity_type || 'one_time',
        event_date: opp.event_date || '',
        start_time: opp.start_time || '',
        end_time: opp.end_time || '',
        location_name: opp.location_name || '',
        is_remote: opp.is_remote || false,
        skills_needed: opp.skills_needed || [],
        spots_available: opp.spots_available || '',
        time_commitment: opp.time_commitment || '',
        deadline: opp.deadline || '',
        status: opp.status || 'draft',
      })

      // Load applications
      await loadApplications()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadApplications = async () => {
    setLoadingApps(true)
    try {
      const res = await fetch(`/api/volunteers/${id}?include_applications=true`)
      const data = await res.json()

      // Applications come from a separate endpoint — fetch via admin client
      const appsRes = await fetch(`/api/volunteers?status=all&include_apps_for=${id}`)
      // Fallback: just use what we have from the opportunity endpoint
      // The applications will be loaded through a dedicated query
      setApplications([])

      // Actually fetch applications directly
      const appRes = await fetch(`/api/volunteers/${id}/applications`)
      if (appRes.ok) {
        const appData = await appRes.json()
        setApplications(appData.applications || [])
      }
    } catch {
      // Applications will be empty
    } finally {
      setLoadingApps(false)
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
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const payload = {
        ...formData,
        spots_available: formData.spots_available ? parseInt(formData.spots_available) : null,
        event_date: formData.opportunity_type === 'one_time' ? formData.event_date || null : null,
        start_time: formData.opportunity_type === 'one_time' ? formData.start_time || null : null,
        end_time: formData.opportunity_type === 'one_time' ? formData.end_time || null : null,
        deadline: formData.deadline || null,
      }

      const res = await fetch(`/api/volunteers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update opportunity')
      }

      setSuccess('Opportunity updated successfully!')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReview = async (applicationId, status) => {
    setReviewingId(applicationId)
    try {
      const res = await fetch(`/api/volunteers/${id}/applications/${applicationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes: adminNotes })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update application')
      }

      setAdminNotes('')
      await loadApplications()
    } catch (err) {
      setError(err.message)
    } finally {
      setReviewingId(null)
    }
  }

  const inputClass = "w-full px-3 py-2 text-sm border border-stone-200 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
  const labelClass = "block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500">Loading opportunity...</p>
        </div>
      </div>
    )
  }

  const statusBadge = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    approved: 'bg-green-50 text-green-700 border-green-200',
    rejected: 'bg-red-50 text-red-700 border-red-200',
    withdrawn: 'bg-gray-50 text-gray-500 border-gray-200',
  }

  // Group applications by status
  const pendingApps = applications.filter(a => a.status === 'pending')
  const approvedApps = applications.filter(a => a.status === 'approved')
  const rejectedApps = applications.filter(a => a.status === 'rejected')
  const withdrawnApps = applications.filter(a => a.status === 'withdrawn')

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Edit Opportunity</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6 text-sm flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-6 mb-8">
        <div className="grid lg:grid-cols-3 gap-6">
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
                      <label className={labelClass}>Event Date</label>
                      <input
                        type="date"
                        name="event_date"
                        value={formData.event_date}
                        onChange={handleChange}
                        className={inputClass}
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
                  <label htmlFor="is_remote" className="text-sm text-gray-700">Remote opportunity</label>
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

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Capacity */}
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
                  <option value="filled">Filled</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            {/* Submit */}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-labor-red rounded hover:bg-labor-red/90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/workspace/organize')}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50"
              >
                Back to List
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Applications Section */}
      <div className="bg-white border border-stone-200 rounded">
        <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Applications ({applications.length})</h2>
          {pendingApps.length > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700">
              {pendingApps.length} pending
            </span>
          )}
        </div>

        {loadingApps ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-labor-red mx-auto"></div>
          </div>
        ) : applications.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No applications yet.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {[...pendingApps, ...approvedApps, ...rejectedApps, ...withdrawnApps].map(app => (
              <div key={app.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-gray-900">
                        {app.members?.first_name} {app.members?.last_name}
                      </span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusBadge[app.status]}`}>
                        {app.status}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">{app.members?.email}</div>
                    {app.message && (
                      <p className="mt-2 text-sm text-gray-700">{app.message}</p>
                    )}
                    {app.availability_notes && (
                      <p className="mt-1 text-xs text-gray-500">Availability: {app.availability_notes}</p>
                    )}
                    {app.admin_notes && (
                      <p className="mt-1 text-xs text-gray-400">Admin notes: {app.admin_notes}</p>
                    )}
                    <div className="mt-1 text-xs text-gray-400">
                      Applied {new Date(app.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                  {app.status === 'pending' && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="text"
                        placeholder="Notes (optional)"
                        value={reviewingId === app.id ? adminNotes : ''}
                        onChange={(e) => {
                          setReviewingId(app.id)
                          setAdminNotes(e.target.value)
                        }}
                        className="px-2 py-1 text-xs border border-stone-200 rounded w-32"
                      />
                      <button
                        onClick={() => handleReview(app.id, 'approved')}
                        disabled={reviewingId === app.id && saving}
                        className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReview(app.id, 'rejected')}
                        disabled={reviewingId === app.id && saving}
                        className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
