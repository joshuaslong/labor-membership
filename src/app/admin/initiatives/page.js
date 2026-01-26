'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const STATUS_LABELS = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  active: { label: 'Active', className: 'bg-green-50 text-green-700' },
  completed: { label: 'Completed', className: 'bg-blue-50 text-blue-700' },
  archived: { label: 'Archived', className: 'bg-gray-100 text-gray-500' },
}

export default function AdminInitiativesPage() {
  const [initiatives, setInitiatives] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingInitiative, setEditingInitiative] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    slug: '',
    title: '',
    description: '',
    long_description: '',
    status: 'draft',
    image_url: '',
    suggested_amounts: [10, 25, 50, 100],
    allow_custom_amount: true,
    min_amount: 5,
    display_order: 0,
  })

  useEffect(() => {
    fetchInitiatives()
  }, [])

  const fetchInitiatives = async () => {
    try {
      const res = await fetch('/api/admin/initiatives')
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setInitiatives(data.initiatives || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSuggestedAmountsChange = (e) => {
    const value = e.target.value
    // Parse comma-separated numbers
    const amounts = value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
    setFormData(prev => ({ ...prev, suggested_amounts: amounts }))
  }

  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  const handleTitleChange = (e) => {
    const title = e.target.value
    setFormData(prev => ({
      ...prev,
      title,
      // Auto-generate slug only for new initiatives
      slug: !editingInitiative ? generateSlug(title) : prev.slug
    }))
  }

  const resetForm = () => {
    setFormData({
      slug: '',
      title: '',
      description: '',
      long_description: '',
      status: 'draft',
      image_url: '',
      suggested_amounts: [10, 25, 50, 100],
      allow_custom_amount: true,
      min_amount: 5,
      display_order: 0,
    })
    setEditingInitiative(null)
    setShowForm(false)
  }

  const handleEdit = (initiative) => {
    setFormData({
      slug: initiative.slug,
      title: initiative.title,
      description: initiative.description || '',
      long_description: initiative.long_description || '',
      status: initiative.status,
      image_url: initiative.image_url || '',
      suggested_amounts: initiative.suggested_amounts || [10, 25, 50, 100],
      allow_custom_amount: initiative.allow_custom_amount !== false,
      min_amount: initiative.min_amount || 5,
      display_order: initiative.display_order || 0,
    })
    setEditingInitiative(initiative)
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const url = editingInitiative
        ? `/api/admin/initiatives/${editingInitiative.id}`
        : '/api/admin/initiatives'

      const res = await fetch(url, {
        method: editingInitiative ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      resetForm()
      fetchInitiatives()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (initiative) => {
    if (!confirm(`Delete "${initiative.title}"? This cannot be undone.`)) return

    try {
      const res = await fetch(`/api/admin/initiatives/${initiative.id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      fetchInitiatives()
    } catch (err) {
      alert(`Failed to delete: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/admin" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block">
        &larr; Back to Admin Dashboard
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl text-gray-900">Initiatives</h1>
          <p className="text-gray-600 mt-1">Manage direct action campaigns</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="btn-primary"
          >
            New Initiative
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card mb-8">
          <h2 className="text-xl font-semibold mb-6">
            {editingInitiative ? 'Edit Initiative' : 'New Initiative'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleTitleChange}
                  required
                  className="input-field"
                  placeholder="ICE Protestor Care Packages"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL Slug *
                </label>
                <input
                  type="text"
                  name="slug"
                  value={formData.slug}
                  onChange={handleInputChange}
                  required
                  pattern="[a-z0-9-]+"
                  className="input-field"
                  placeholder="care-packages"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lowercase letters, numbers, and hyphens only
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Short Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={2}
                className="input-field"
                placeholder="Brief description shown on cards..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Description
              </label>
              <textarea
                name="long_description"
                value={formData.long_description}
                onChange={handleInputChange}
                rows={4}
                className="input-field"
                placeholder="Detailed description shown on the initiative page..."
              />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="input-field"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  name="display_order"
                  value={formData.display_order}
                  onChange={handleInputChange}
                  min="0"
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Amount ($)
                </label>
                <input
                  type="number"
                  name="min_amount"
                  value={formData.min_amount}
                  onChange={handleInputChange}
                  min="1"
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Suggested Amounts
              </label>
              <input
                type="text"
                value={formData.suggested_amounts.join(', ')}
                onChange={handleSuggestedAmountsChange}
                className="input-field"
                placeholder="10, 25, 50, 100"
              />
              <p className="text-xs text-gray-500 mt-1">
                Comma-separated dollar amounts
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image URL
              </label>
              <input
                type="url"
                name="image_url"
                value={formData.image_url}
                onChange={handleInputChange}
                className="input-field"
                placeholder="https://..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="allow_custom_amount"
                id="allow_custom_amount"
                checked={formData.allow_custom_amount}
                onChange={handleInputChange}
                className="rounded border-gray-300 text-labor-red focus:ring-labor-red"
              />
              <label htmlFor="allow_custom_amount" className="text-sm text-gray-700">
                Allow custom donation amounts
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : (editingInitiative ? 'Update Initiative' : 'Create Initiative')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Initiatives List */}
      {initiatives.length === 0 ? (
        <div className="text-center py-12 card">
          <div className="text-4xl mb-2">📋</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No initiatives yet</h3>
          <p className="text-gray-500 text-sm">Create your first initiative to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {initiatives.map((initiative) => (
            <div
              key={initiative.id}
              className="card flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {initiative.title}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_LABELS[initiative.status]?.className || 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[initiative.status]?.label || initiative.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">
                  /{initiative.slug}
                </p>
                {initiative.description && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                    {initiative.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 ml-4">
                <Link
                  href={`/initiatives/${initiative.slug}`}
                  target="_blank"
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded font-medium"
                >
                  View
                </Link>
                <button
                  onClick={() => handleEdit(initiative)}
                  className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-medium"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(initiative)}
                  className="px-3 py-1.5 text-sm bg-red-50 text-red-700 hover:bg-red-100 rounded font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
