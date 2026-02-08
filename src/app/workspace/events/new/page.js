'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ChapterSelect from '@/components/ChapterSelect'
import RecurrenceBuilder from '@/components/RecurrenceBuilder'

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
]

export default function CreateEventPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [chapters, setChapters] = useState([])

  const [formData, setFormData] = useState({
    chapter_id: '',
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
    status: 'draft'
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
    loadChapters()
  }, [])

  const loadChapters = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return

    // Get admin info
    const { data: adminRecords } = await supabase
      .from('admin_users')
      .select('id, role, chapter_id, chapters(id, name)')
      .eq('user_id', user.id)

    let admin = null
    if (adminRecords && adminRecords.length > 0) {
      const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
      admin = adminRecords.reduce((highest, current) => {
        const currentIndex = roleHierarchy.indexOf(current.role)
        const highestIndex = roleHierarchy.indexOf(highest.role)
        return currentIndex < highestIndex ? current : highest
      }, adminRecords[0])
    }

    // Load chapters based on admin role
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload = {
        ...formData,
        max_attendees: formData.max_attendees ? parseInt(formData.max_attendees) : null,
        rsvp_deadline: formData.rsvp_deadline || null,
        start_time: formData.is_all_day ? null : formData.start_time || null,
        end_time: formData.is_all_day ? null : formData.end_time || null,
        end_date: formData.end_date || null
      }

      // Add recurrence data if enabled
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
      }

      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create event')
      }

      router.push('/workspace/events')
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
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Create Event</h1>
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
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Draft events are only visible to admins.
                  </p>
                </div>

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

            {/* Submit */}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-labor-red rounded hover:bg-labor-red/90 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Event'}
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
