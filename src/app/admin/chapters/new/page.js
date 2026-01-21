'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const LEVELS = ['state', 'county', 'city']
const ALL_LEVELS = ['national', 'state', 'county', 'city']

export default function NewChapterPage() {
  const router = useRouter()
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    name: '',
    level: 'state',
    parent_id: '',
    state_code: '',
    county_name: '',
    city_name: '',
    contact_email: '',
  })

  useEffect(() => {
    fetch('/api/chapters')
      .then(r => r.json())
      .then(data => setChapters(data.chapters || []))
  }, [])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Filter valid parents based on selected level
  const validParents = chapters.filter(c => {
    const levelIndex = ALL_LEVELS.indexOf(form.level)
    const parentLevelIndex = ALL_LEVELS.indexOf(c.level)
    return parentLevelIndex < levelIndex // Parent must be higher level
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create chapter')
      }

      router.push('/chapters')
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <h1 className="text-3xl text-gray-900 mb-2">Create Chapter</h1>
      <p className="text-gray-600 mb-8">Add a new chapter to the organization.</p>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Chapter Name *</label>
          <input
            required
            className="input-field"
            placeholder="e.g., Pennsylvania State Chapter"
            value={form.name}
            onChange={e => updateField('name', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Level *</label>
          <select
            required
            className="input-field"
            value={form.level}
            onChange={e => updateField('level', e.target.value)}
          >
            {LEVELS.map(level => (
              <option key={level} value={level}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {form.level !== 'national' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Parent Chapter *</label>
            <select
              required
              className="input-field"
              value={form.parent_id}
              onChange={e => updateField('parent_id', e.target.value)}
            >
              <option value="">Select parent chapter...</option>
              {validParents.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.level})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Members of this chapter will automatically be included in the parent chapter's count.
            </p>
          </div>
        )}

        {(form.level === 'state' || form.level === 'county' || form.level === 'city') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State Code</label>
            <input
              className="input-field"
              maxLength={2}
              placeholder="PA"
              value={form.state_code}
              onChange={e => updateField('state_code', e.target.value.toUpperCase())}
            />
          </div>
        )}

        {(form.level === 'county' || form.level === 'city') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">County Name</label>
            <input
              className="input-field"
              placeholder="Allegheny"
              value={form.county_name}
              onChange={e => updateField('county_name', e.target.value)}
            />
          </div>
        )}

        {form.level === 'city' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City Name</label>
            <input
              className="input-field"
              placeholder="Pittsburgh"
              value={form.city_name}
              onChange={e => updateField('city_name', e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
          <input
            type="email"
            className="input-field"
            placeholder="chapter@votelabor.org"
            value={form.contact_email}
            onChange={e => updateField('contact_email', e.target.value)}
          />
        </div>

        <button type="submit" disabled={loading} className="w-full btn-primary py-3">
          {loading ? 'Creating...' : 'Create Chapter'}
        </button>
      </form>
    </div>
  )
}
