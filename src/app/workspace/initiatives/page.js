'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const STATUS_OPTIONS = ['draft', 'active', 'completed', 'archived']

const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-50 text-green-700',
  completed: 'bg-blue-50 text-blue-700',
  archived: 'bg-stone-100 text-stone-500',
}

export default function WorkspaceInitiativesPage() {
  const router = useRouter()
  const [initiatives, setInitiatives] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // initiative id or 'new'
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
    long_description: '',
    status: 'draft',
    suggested_amounts: [10, 25, 50, 100],
    allow_custom_amount: true,
    min_amount: 5,
    display_order: 0,
  })

  useEffect(() => {
    loadInitiatives()
  }, [])

  async function loadInitiatives() {
    const res = await fetch('/api/workspace/initiatives')
    if (res.ok) {
      const data = await res.json()
      setInitiatives(data.initiatives || [])
    }
    setLoading(false)
  }

  function startNew() {
    setForm({
      title: '',
      slug: '',
      description: '',
      long_description: '',
      status: 'draft',
      suggested_amounts: [10, 25, 50, 100],
      allow_custom_amount: true,
      min_amount: 5,
      display_order: initiatives.length + 1,
    })
    setEditing('new')
    setError(null)
  }

  function startEdit(initiative) {
    setForm({
      title: initiative.title || '',
      slug: initiative.slug || '',
      description: initiative.description || '',
      long_description: initiative.long_description || '',
      status: initiative.status || 'draft',
      suggested_amounts: initiative.suggested_amounts || [10, 25, 50, 100],
      allow_custom_amount: initiative.allow_custom_amount !== false,
      min_amount: initiative.min_amount || 5,
      display_order: initiative.display_order || 0,
    })
    setEditing(initiative.id)
    setError(null)
  }

  function generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const method = editing === 'new' ? 'POST' : 'PUT'
    const url = editing === 'new'
      ? '/api/workspace/initiatives'
      : `/api/workspace/initiatives/${editing}`

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to save')
      setSaving(false)
      return
    }

    setEditing(null)
    setSaving(false)
    await loadInitiatives()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this initiative? This cannot be undone.')) return

    const res = await fetch(`/api/workspace/initiatives/${id}`, { method: 'DELETE' })
    if (res.ok) {
      await loadInitiatives()
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
      </div>
    )
  }

  // Editing / Creating form
  if (editing) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <button
          onClick={() => setEditing(null)}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to initiatives
        </button>

        <h1 className="text-xl font-semibold text-gray-900 tracking-tight mb-6">
          {editing === 'new' ? 'New Initiative' : 'Edit Initiative'}
        </h1>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSave} className="bg-white border border-stone-200 rounded p-5 space-y-4">
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
                  slug: editing === 'new' ? generateSlug(title) : f.slug,
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
              {saving ? 'Saving...' : editing === 'new' ? 'Create Initiative' : 'Save Changes'}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="btn-secondary px-6">
              Cancel
            </button>
          </div>
        </form>
      </div>
    )
  }

  // List view
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Initiatives</h1>
          <p className="text-sm text-gray-500 mt-1">{initiatives.length} initiative{initiatives.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={startNew} className="btn-primary flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Initiative
        </button>
      </div>

      {initiatives.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded px-4 py-12 text-center">
          <p className="text-sm text-gray-500 mb-3">No initiatives yet.</p>
          <button onClick={startNew} className="text-sm text-labor-red hover:text-labor-red-dark font-medium">
            Create your first initiative
          </button>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Order</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {initiatives.map(initiative => (
                <tr key={initiative.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{initiative.title}</div>
                    {initiative.description && (
                      <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{initiative.description}</div>
                    )}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 sm:hidden ${STATUS_STYLES[initiative.status]}`}>
                      {initiative.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[initiative.status]}`}>
                      {initiative.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{initiative.display_order}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => startEdit(initiative)}
                        className="text-gray-500 hover:text-gray-700 text-xs font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(initiative.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
