'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const ALL_LEVELS = ['national', 'state', 'county', 'city']
const CREATABLE_LEVELS = ['state', 'county', 'city']
const LEVEL_LABELS = {
  national: 'National',
  state: 'State',
  county: 'County',
  city: 'City',
}

export default function CreateChapterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const parentIdParam = searchParams.get('parent')

  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    name: '',
    level: 'state',
    parent_id: parentIdParam || '',
    state_code: '',
    county_name: '',
    city_name: '',
    contact_email: '',
  })

  useEffect(() => {
    fetch('/api/chapters')
      .then(r => r.json())
      .then(data => {
        setChapters(data.chapters || [])
        setLoading(false)

        // If parent param provided, set level based on parent
        if (parentIdParam) {
          const parent = data.chapters?.find(c => c.id === parentIdParam)
          if (parent) {
            const parentLevelIndex = ALL_LEVELS.indexOf(parent.level)
            const nextLevel = ALL_LEVELS[parentLevelIndex + 1]
            if (nextLevel && CREATABLE_LEVELS.includes(nextLevel)) {
              setForm(prev => ({ ...prev, level: nextLevel, parent_id: parentIdParam }))
            }
          }
        }
      })
      .catch(() => setLoading(false))
  }, [parentIdParam])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const validParents = chapters.filter(c => {
    const levelIndex = ALL_LEVELS.indexOf(form.level)
    const parentLevelIndex = ALL_LEVELS.indexOf(c.level)
    return parentLevelIndex < levelIndex
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create chapter')

      router.push(`/workspace/chapters/${data.chapter.id}`)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const inputClass = "w-full px-3 py-2 text-sm border border-stone-200 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
  const labelClass = "block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"

  if (loading) {
    return (
      <div className="bg-white border border-stone-200 rounded p-8 text-center text-gray-500">
        Loading...
      </div>
    )
  }

  return (
    <>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border border-stone-200 rounded">
          <div className="px-4 py-3 border-b border-stone-200">
            <h2 className="text-sm font-semibold text-gray-900">Chapter Details</h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className={labelClass}>Chapter Name *</label>
              <input
                required
                className={inputClass}
                placeholder="e.g., Wisconsin Labor Party"
                value={form.name}
                onChange={e => updateField('name', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Level *</label>
                <select
                  required
                  className={inputClass}
                  value={form.level}
                  onChange={e => updateField('level', e.target.value)}
                >
                  {CREATABLE_LEVELS.map(level => (
                    <option key={level} value={level}>
                      {LEVEL_LABELS[level]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>Parent Chapter *</label>
                <select
                  required
                  className={inputClass}
                  value={form.parent_id}
                  onChange={e => updateField('parent_id', e.target.value)}
                >
                  <option value="">Select parent...</option>
                  {validParents.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({LEVEL_LABELS[c.level]})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>Contact Email</label>
              <input
                type="email"
                className={inputClass}
                placeholder="chapter@votelabor.org"
                value={form.contact_email}
                onChange={e => updateField('contact_email', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded">
          <div className="px-4 py-3 border-b border-stone-200">
            <h2 className="text-sm font-semibold text-gray-900">Location</h2>
          </div>
          <div className="p-4 space-y-4">
            {(form.level === 'state' || form.level === 'county' || form.level === 'city') && (
              <div>
                <label className={labelClass}>State Code</label>
                <input
                  className={inputClass}
                  maxLength={2}
                  placeholder="WI"
                  value={form.state_code}
                  onChange={e => updateField('state_code', e.target.value.toUpperCase())}
                />
                <p className="text-xs text-gray-400 mt-1">Two-letter state abbreviation</p>
              </div>
            )}

            {(form.level === 'county' || form.level === 'city') && (
              <div>
                <label className={labelClass}>County Name</label>
                <input
                  className={inputClass}
                  placeholder="Brown"
                  value={form.county_name}
                  onChange={e => updateField('county_name', e.target.value)}
                />
              </div>
            )}

            {form.level === 'city' && (
              <div>
                <label className={labelClass}>City Name</label>
                <input
                  className={inputClass}
                  placeholder="Green Bay"
                  value={form.city_name}
                  onChange={e => updateField('city_name', e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-labor-red rounded hover:bg-labor-red/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Creating...' : 'Create Chapter'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/workspace/chapters')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </>
  )
}
