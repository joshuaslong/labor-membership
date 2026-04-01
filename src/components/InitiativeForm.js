'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUS_OPTIONS = ['draft', 'active', 'completed', 'archived']

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export default function InitiativeForm({ initiative = null }) {
  const router = useRouter()
  const isNew = !initiative
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    title: initiative?.title || '',
    slug: initiative?.slug || '',
    description: initiative?.description || '',
    long_description: initiative?.long_description || '',
    status: initiative?.status || 'draft',
    suggested_amounts: initiative?.suggested_amounts || [10, 25, 50, 100],
    allow_custom_amount: initiative?.allow_custom_amount !== false,
    min_amount: initiative?.min_amount || 5,
    display_order: initiative?.display_order || 0,
  })

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const method = isNew ? 'POST' : 'PUT'
    const url = isNew
      ? '/api/workspace/initiatives'
      : `/api/workspace/initiatives/${initiative.id}`

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      router.push('/workspace/initiatives')
      router.refresh()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-6">
        {isNew ? 'New Initiative' : 'Edit Initiative'}
      </h1>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            className="input-field"
            required
            value={form.title}
            onChange={(e) => {
              const title = e.target.value
              setForm(f => ({
                ...f,
                title,
                slug: isNew ? generateSlug(title) : f.slug,
              }))
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
          <input
            className="input-field"
            required
            value={form.slug}
            onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))}
          />
          <p className="text-xs text-gray-500 mt-1">URL-friendly identifier (e.g. care-packages)</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
          <textarea
            className="input-field"
            rows={2}
            value={form.description}
            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Description</label>
          <textarea
            className="input-field"
            rows={5}
            value={form.long_description}
            onChange={(e) => setForm(f => ({ ...f, long_description: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="input-field"
              value={form.status}
              onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
            <input
              type="number"
              className="input-field"
              value={form.display_order}
              onChange={(e) => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Suggested Amounts</label>
          <input
            className="input-field"
            value={form.suggested_amounts.join(', ')}
            onChange={(e) => {
              const amounts = e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
              setForm(f => ({ ...f, suggested_amounts: amounts }))
            }}
          />
          <p className="text-xs text-gray-500 mt-1">Comma-separated dollar amounts</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Amount ($)</label>
            <input
              type="number"
              className="input-field"
              min="1"
              value={form.min_amount}
              onChange={(e) => setForm(f => ({ ...f, min_amount: parseInt(e.target.value) || 1 }))}
            />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-labor-red focus:ring-labor-red"
                checked={form.allow_custom_amount}
                onChange={(e) => setForm(f => ({ ...f, allow_custom_amount: e.target.checked }))}
              />
              <span className="text-sm text-gray-700">Allow custom amounts</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving} className="btn-primary px-6">
            {saving ? 'Saving...' : isNew ? 'Create Initiative' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/workspace/initiatives')}
            className="btn-secondary px-6"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
