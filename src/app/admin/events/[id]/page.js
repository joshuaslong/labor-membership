'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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
    status: 'draft'
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
        status: event.status || 'draft'
      })
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
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const payload = {
        ...formData,
        max_attendees: formData.max_attendees ? parseInt(formData.max_attendees) : null,
        rsvp_deadline: formData.rsvp_deadline || null,
        start_time: formData.is_all_day ? null : formData.start_time || null,
        end_time: formData.is_all_day ? null : formData.end_time || null,
        end_date: formData.end_date || null
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

      setSuccess('Event updated successfully!')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading event...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/admin/events" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block">
        ← Back to Events
      </Link>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Edit Event</h1>
      <p className="text-gray-600 mb-8">Update event details.</p>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Event Details */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Event Details</h2>
          <div className="space-y-4">
            <div>
              <label className="input-label">Event Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="input-field"
                placeholder="e.g., Monthly Chapter Meeting"
                required
              />
            </div>

            <div>
              <label className="input-label">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="input-field min-h-32"
                placeholder="Describe the event..."
                rows={4}
              />
            </div>
          </div>
        </div>

        {/* Date and Time */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Date & Time</h2>
          <div className="space-y-4">
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
                <label className="input-label">Start Date *</label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="input-field"
                  required
                />
              </div>
              {!formData.is_all_day && (
                <div>
                  <label className="input-label">Start Time</label>
                  <input
                    type="time"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleChange}
                    className="input-field"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">End Date</label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>
              {!formData.is_all_day && (
                <div>
                  <label className="input-label">End Time</label>
                  <input
                    type="time"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleChange}
                    className="input-field"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="input-label">Timezone</label>
              <select
                name="timezone"
                value={formData.timezone}
                onChange={handleChange}
                className="input-field"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Location</h2>
          <div className="space-y-4">
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
                <label className="input-label">Virtual Meeting Link</label>
                <input
                  type="url"
                  name="virtual_link"
                  value={formData.virtual_link}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="https://zoom.us/j/..."
                />
              </div>
            )}

            <div>
              <label className="input-label">Location Name</label>
              <input
                type="text"
                name="location_name"
                value={formData.location_name}
                onChange={handleChange}
                className="input-field"
                placeholder="e.g., Community Center, Online via Zoom"
              />
            </div>

            {!formData.is_virtual && (
              <>
                <div>
                  <label className="input-label">Street Address</label>
                  <input
                    type="text"
                    name="location_address"
                    value={formData.location_address}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="123 Main Street"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <label className="input-label">City</label>
                    <input
                      type="text"
                      name="location_city"
                      value={formData.location_city}
                      onChange={handleChange}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="input-label">State</label>
                    <input
                      type="text"
                      name="location_state"
                      value={formData.location_state}
                      onChange={handleChange}
                      className="input-field"
                      maxLength={2}
                      placeholder="TX"
                    />
                  </div>
                  <div>
                    <label className="input-label">ZIP</label>
                    <input
                      type="text"
                      name="location_zip"
                      value={formData.location_zip}
                      onChange={handleChange}
                      className="input-field"
                      placeholder="12345"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Options */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Options</h2>
          <div className="space-y-4">
            <div>
              <label className="input-label">Maximum Attendees</label>
              <input
                type="number"
                name="max_attendees"
                value={formData.max_attendees}
                onChange={handleChange}
                className="input-field"
                placeholder="Leave blank for unlimited"
                min="1"
              />
            </div>

            <div>
              <label className="input-label">RSVP Deadline</label>
              <input
                type="datetime-local"
                name="rsvp_deadline"
                value={formData.rsvp_deadline}
                onChange={handleChange}
                className="input-field"
              />
              <p className="text-xs text-gray-500 mt-1">
                After this date, members cannot RSVP to this event.
              </p>
            </div>

            <div>
              <label className="input-label">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="input-field"
              >
                <option value="draft">Draft - Only visible to admins</option>
                <option value="published">Published - Visible to members</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary py-3 px-8"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <Link href="/admin/events" className="btn-secondary py-3 px-8">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
