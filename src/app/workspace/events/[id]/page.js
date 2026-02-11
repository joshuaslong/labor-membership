'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import RecurrenceBuilder from '@/components/RecurrenceBuilder'
import { detectPreset, parseEndCondition } from '@/lib/recurrence'

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
]

export default function EditEventPage({ params }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [showScopeModal, setShowScopeModal] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceDescription, setRecurrenceDescription] = useState('')
  const [groups, setGroups] = useState([])
  const [eventChapterId, setEventChapterId] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location_name: '',
    location_address: '',
    location_city: '',
    location_state: '',
    location_zip: '',
    is_virtual: false,
    virtual_link: '',
    start_date: '',
    start_time: '',
    end_date: '',
    end_time: '',
    timezone: 'America/Chicago',
    is_all_day: false,
    max_attendees: '',
    rsvp_deadline: '',
    status: 'draft',
    target_type: 'chapter',
    group_id: '',
    visibility: 'public',
    send_notification: false,
  })

  const [recurrenceData, setRecurrenceData] = useState({
    enabled: false,
    preset: 'weekly',
    endType: 'never',
    endDate: '',
    count: 12,
    customFreq: 'WEEKLY',
    customInterval: 1,
    customByDay: [],
    customMonthlyPosition: '',
  })

  useEffect(() => {
    loadEvent()
  }, [id])

  const loadEvent = async () => {
    try {
      const res = await fetch(`/api/events/${id}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load event')
      }

      const event = data.event
      setFormData({
        title: event.title || '',
        description: event.description || '',
        location_name: event.location_name || '',
        location_address: event.location_address || '',
        location_city: event.location_city || '',
        location_state: event.location_state || '',
        location_zip: event.location_zip || '',
        is_virtual: event.is_virtual || false,
        virtual_link: event.virtual_link || '',
        start_date: event.start_date || '',
        start_time: event.start_time || '',
        end_date: event.end_date || '',
        end_time: event.end_time || '',
        timezone: event.timezone || 'America/Chicago',
        is_all_day: event.is_all_day || false,
        max_attendees: event.max_attendees || '',
        rsvp_deadline: event.rsvp_deadline ? event.rsvp_deadline.slice(0, 16) : '',
        status: event.status || 'draft',
        target_type: event.target_type || 'chapter',
        group_id: event.group_id || '',
        visibility: event.visibility || 'public',
      })

      // Load groups for this event's chapter
      setEventChapterId(event.chapter_id || '')
      if (event.chapter_id) {
        try {
          const groupsRes = await fetch(`/api/admin/groups?chapterId=${event.chapter_id}`)
          const groupsData = await groupsRes.json()
          setGroups(groupsData.groups || [])
        } catch {
          setGroups([])
        }
      }

      // Set recurrence state
      const hasRrule = !!event.rrule
      setIsRecurring(hasRrule)
      setRecurrenceDescription(event.recurrence_description || '')

      if (hasRrule) {
        const detectedPreset = detectPreset(event.rrule, event.start_date)
        const endCondition = parseEndCondition(event.rrule)

        setRecurrenceData({
          enabled: true,
          preset: detectedPreset || 'custom',
          endType: endCondition.endType,
          endDate: endCondition.endDate || '',
          count: endCondition.count || 12,
          customFreq: 'WEEKLY',
          customInterval: 1,
          customByDay: [],
          customMonthlyPosition: '',
        })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // If editing a recurring event, show scope modal
    if (isRecurring) {
      setShowScopeModal(true)
      return
    }

    await saveEvent('all')
  }

  const saveEvent = async (editScope) => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    setShowScopeModal(false)

    try {
      const payload = {
        ...formData,
        max_attendees: formData.max_attendees ? parseInt(formData.max_attendees) : null,
        rsvp_deadline: formData.rsvp_deadline || null,
        start_time: formData.is_all_day ? null : formData.start_time || null,
        end_time: formData.is_all_day ? null : formData.end_time || null,
        end_date: formData.end_date || null,
        edit_scope: editScope,
        target_type: formData.target_type,
        group_id: formData.target_type === 'group' ? formData.group_id : null,
        visibility: formData.visibility,
      }

      // For "this" scope, use the event's start_date as instance_date
      if (editScope === 'this' || editScope === 'this_and_following') {
        payload.instance_date = formData.start_date
      }

      // Handle recurrence changes for "all" scope
      if (editScope === 'all') {
        if (recurrenceData.enabled) {
          payload.recurrence_preset = recurrenceData.preset
          payload.recurrence_options = {
            endType: recurrenceData.endType,
            endDate: recurrenceData.endDate,
            count: recurrenceData.count,
            customFreq: recurrenceData.customFreq,
            customInterval: recurrenceData.customInterval,
            customByDay: recurrenceData.customByDay,
            customMonthlyPosition: recurrenceData.customMonthlyPosition,
          }
        } else if (isRecurring) {
          // Removing recurrence from a recurring event
          payload.recurrence_preset = 'none'
        }
      }

      const res = await fetch(`/api/events/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update event')
      }

      if (data.split) {
        setSuccess('Series split. Redirecting to new event...')
        setTimeout(() => router.push(`/workspace/events/${data.event.id}`), 1500)
      } else {
        setSuccess('Event updated successfully!')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full px-3 py-2 text-sm border border-stone-200 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
  const labelClass = "block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
          <p className="mt-4 text-sm text-gray-500">Loading event...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Edit Event</h1>
        {isRecurring && recurrenceDescription && (
          <p className="text-xs text-gray-500 mt-1">
            Recurring: {recurrenceDescription}
          </p>
        )}
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

      {/* Edit Scope Modal */}
      {showScopeModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-stone-200 shadow-lg max-w-sm w-full p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Edit Recurring Event</h3>
            <p className="text-xs text-gray-500 mb-4">How would you like to apply these changes?</p>
            <div className="space-y-2">
              <button
                onClick={() => saveEvent('this')}
                disabled={saving}
                className="w-full px-4 py-2.5 text-sm text-left font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50 disabled:opacity-50"
              >
                This event only
                <span className="block text-xs text-gray-400 font-normal mt-0.5">Only change this specific occurrence</span>
              </button>
              <button
                onClick={() => saveEvent('this_and_following')}
                disabled={saving}
                className="w-full px-4 py-2.5 text-sm text-left font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50 disabled:opacity-50"
              >
                This and all following
                <span className="block text-xs text-gray-400 font-normal mt-0.5">Split the series from this date forward</span>
              </button>
              <button
                onClick={() => saveEvent('all')}
                disabled={saving}
                className="w-full px-4 py-2.5 text-sm text-left font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50 disabled:opacity-50"
              >
                All events in the series
                <span className="block text-xs text-gray-400 font-normal mt-0.5">Apply changes to every occurrence</span>
              </button>
            </div>
            <button
              onClick={() => setShowScopeModal(false)}
              className="w-full mt-3 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main content - 2/3 */}
          <div className="lg:col-span-2 space-y-6">
            {/* Event Details */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Event Details</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className={labelClass}>Event Title *</label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="e.g., Monthly Chapter Meeting"
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className={`${inputClass} min-h-24`}
                    placeholder="Describe the event..."
                    rows={4}
                  />
                </div>
              </div>
            </div>

            {/* Date and Time */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Date & Time</h2>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_all_day"
                    name="is_all_day"
                    checked={formData.is_all_day}
                    onChange={handleChange}
                    className="w-4 h-4 text-labor-red border-gray-300 rounded focus:ring-labor-red"
                  />
                  <label htmlFor="is_all_day" className="text-sm text-gray-700">All day event</label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Start Date *</label>
                    <input
                      type="date"
                      name="start_date"
                      value={formData.start_date}
                      onChange={handleChange}
                      className={inputClass}
                      required
                    />
                  </div>
                  {!formData.is_all_day && (
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
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>End Date</label>
                    <input
                      type="date"
                      name="end_date"
                      value={formData.end_date}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </div>
                  {!formData.is_all_day && (
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
                  )}
                </div>

                {/* Recurrence */}
                <RecurrenceBuilder
                  startDate={formData.start_date}
                  recurrenceData={recurrenceData}
                  onChange={setRecurrenceData}
                  inputClass={inputClass}
                  labelClass={labelClass}
                />

                <div>
                  <label className={labelClass}>Timezone</label>
                  <select
                    name="timezone"
                    value={formData.timezone}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    {TIMEZONES.map((tz) => (
                      <option key={tz.value} value={tz.value}>{tz.label}</option>
                    ))}
                  </select>
                </div>
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
                    id="is_virtual"
                    name="is_virtual"
                    checked={formData.is_virtual}
                    onChange={handleChange}
                    className="w-4 h-4 text-labor-red border-gray-300 rounded focus:ring-labor-red"
                  />
                  <label htmlFor="is_virtual" className="text-sm text-gray-700">This is a virtual event</label>
                </div>

                {formData.is_virtual && (
                  <div>
                    <label className={labelClass}>Virtual Meeting Link</label>
                    <input
                      type="url"
                      name="virtual_link"
                      value={formData.virtual_link}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="https://zoom.us/j/..."
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Location Name</label>
                  <input
                    type="text"
                    name="location_name"
                    value={formData.location_name}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="e.g., Community Center"
                  />
                </div>

                {!formData.is_virtual && (
                  <>
                    <div>
                      <label className={labelClass}>Street Address</label>
                      <input
                        type="text"
                        name="location_address"
                        value={formData.location_address}
                        onChange={handleChange}
                        className={inputClass}
                        placeholder="123 Main Street"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="col-span-2">
                        <label className={labelClass}>City</label>
                        <input
                          type="text"
                          name="location_city"
                          value={formData.location_city}
                          onChange={handleChange}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>State</label>
                        <input
                          type="text"
                          name="location_state"
                          value={formData.location_state}
                          onChange={handleChange}
                          className={inputClass}
                          maxLength={2}
                          placeholder="TX"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>ZIP</label>
                        <input
                          type="text"
                          name="location_zip"
                          value={formData.location_zip}
                          onChange={handleChange}
                          className={inputClass}
                          placeholder="12345"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - 1/3 */}
          <div className="space-y-6">
            {/* Audience */}
            {groups.length > 0 && (
              <div className="bg-white border border-stone-200 rounded">
                <div className="px-4 py-3 border-b border-stone-200">
                  <h2 className="text-sm font-semibold text-gray-900">Audience</h2>
                </div>
                <div className="p-4 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="target_type"
                      value="chapter"
                      checked={formData.target_type === 'chapter'}
                      onChange={handleChange}
                      className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
                    />
                    <span className="text-sm text-gray-700">Entire Chapter</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="target_type"
                      value="group"
                      checked={formData.target_type === 'group'}
                      onChange={handleChange}
                      className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
                    />
                    <span className="text-sm text-gray-700">Chapter Group</span>
                  </label>
                  {formData.target_type === 'group' && (
                    <select
                      name="group_id"
                      value={formData.group_id}
                      onChange={handleChange}
                      className={inputClass}
                      required
                    >
                      <option value="">Select a group...</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name} ({g.member_count} members)</option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-gray-400">
                    {formData.target_type === 'group'
                      ? 'Only group members will be notified.'
                      : 'All chapter members will be notified.'}
                  </p>
                </div>
              </div>
            )}

            {/* Visibility */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Visibility</h2>
              </div>
              <div className="p-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={formData.visibility === 'public'}
                    onChange={handleChange}
                    className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
                  />
                  <span className="text-sm text-gray-700">Public</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="visibility"
                    value="internal"
                    checked={formData.visibility === 'internal'}
                    onChange={handleChange}
                    className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
                  />
                  <span className="text-sm text-gray-700">Internal (Members Only)</span>
                </label>
                <p className="text-xs text-gray-400">
                  {formData.visibility === 'internal'
                    ? 'Only visible in the workspace.'
                    : 'Visible on the public events page.'}
                </p>
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
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {formData.status === 'published' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="send_notification"
                      name="send_notification"
                      checked={formData.send_notification}
                      onChange={handleChange}
                      className="w-4 h-4 text-labor-red border-gray-300 rounded focus:ring-labor-red"
                    />
                    <label htmlFor="send_notification" className="text-sm text-gray-700">
                      Send notification emails to members
                    </label>
                  </div>
                )}

                <div>
                  <label className={labelClass}>Max Attendees</label>
                  <input
                    type="number"
                    name="max_attendees"
                    value={formData.max_attendees}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Unlimited"
                    min="1"
                  />
                </div>

                <div>
                  <label className={labelClass}>RSVP Deadline</label>
                  <input
                    type="datetime-local"
                    name="rsvp_deadline"
                    value={formData.rsvp_deadline}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">Actions</h2>
              </div>
              <div className="p-4 space-y-2">
                <Link
                  href={`/workspace/events/${id}/rsvps`}
                  className="block w-full px-4 py-2 text-sm text-center font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50"
                >
                  View RSVPs
                </Link>
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
                onClick={() => router.push('/workspace/events')}
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
