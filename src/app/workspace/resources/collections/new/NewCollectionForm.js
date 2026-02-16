'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function NewCollectionForm({ isTopAdmin = false, chapterId = null }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState(chapterId ? 'chapter' : 'national')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleNameChange = (value) => {
    setName(value)
    if (!slugEdited) {
      setSlug(generateSlug(value))
    }
  }

  const handleSlugChange = (value) => {
    setSlugEdited(true)
    setSlug(generateSlug(value))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !slug.trim()) return

    setSaving(true)
    setError(null)

    try {
      const body = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
      }

      if (isTopAdmin && scope === 'national') {
        body.chapter_id = null
      }

      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create collection')

      const collectionId = data.id || data.collection?.id
      router.push(`/workspace/resources/collections/${collectionId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      {/* Back link */}
      <Link
        href="/workspace/resources/collections"
        className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-4"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Collections
      </Link>

      <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-6">New Collection</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-xs font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Campaign Assets 2026"
            className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
            required
          />
        </div>

        {/* Slug */}
        <div>
          <label htmlFor="slug" className="block text-xs font-medium text-gray-700 mb-1">
            Slug
          </label>
          <div className="flex items-center gap-0">
            <span className="text-sm text-gray-400 bg-stone-50 border border-r-0 border-stone-200 rounded-l px-3 py-2">
              /
            </span>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="campaign-assets-2026"
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-stone-200 rounded-r focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
              required
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Used in the public URL. Lowercase, hyphens only.</p>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-xs font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Brief description of this collection..."
            className="w-full px-3 py-2 text-sm bg-white border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red resize-none"
          />
        </div>

        {/* Scope selector for top admins */}
        {isTopAdmin && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Scope
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="national"
                  checked={scope === 'national'}
                  onChange={() => setScope('national')}
                  className="text-labor-red focus:ring-labor-red"
                />
                <span className="text-sm text-gray-700">National</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="chapter"
                  checked={scope === 'chapter'}
                  onChange={() => setScope('chapter')}
                  className="text-labor-red focus:ring-labor-red"
                />
                <span className="text-sm text-gray-700">Chapter</span>
              </label>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              National collections are visible on the main resources portal. Chapter collections appear on the chapter portal.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !name.trim() || !slug.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-labor-red hover:bg-labor-red/90 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            Create Collection
          </button>
          <Link
            href="/workspace/resources/collections"
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
