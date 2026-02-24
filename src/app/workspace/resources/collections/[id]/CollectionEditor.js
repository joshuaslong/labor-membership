'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import FilePicker from './FilePicker'

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function FileTypeIcon({ mimeType, className = 'w-5 h-5' }) {
  if (!mimeType) {
    return (
      <svg className={`${className} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  }
  if (mimeType.startsWith('image/')) {
    return (
      <svg className={`${className} text-emerald-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  }
  if (mimeType.startsWith('video/')) {
    return (
      <svg className={`${className} text-purple-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    )
  }
  if (mimeType.startsWith('audio/')) {
    return (
      <svg className={`${className} text-blue-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    )
  }
  if (mimeType === 'application/pdf') {
    return (
      <svg className={`${className} text-red-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-6 3h4" />
      </svg>
    )
  }
  return (
    <svg className={`${className} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

function SectionCard({ section, onUpdate, onDelete, onMoveUp, onMoveDown, isFirst, isLast, onOpenFilePicker }) {
  const [name, setName] = useState(section.name || '')
  const [saving, setSaving] = useState(false)

  const handleBlurName = async () => {
    const trimmed = name.trim()
    if (trimmed === section.name || !trimmed) {
      setName(section.name || '')
      return
    }
    setSaving(true)
    try {
      await onUpdate(section.id, { name: trimmed })
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveFile = async (fileId) => {
    const currentFileIds = (section.files || []).map(f => f.file_id || f.id)
    const updatedFileIds = currentFileIds.filter(id => id !== fileId)
    await onUpdate(section.id, { file_ids: updatedFileIds }, true)
  }

  return (
    <div className="bg-white border border-stone-200 rounded-lg shadow-sm">
      {/* Section header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onMoveUp(section.id)}
            disabled={isFirst}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move up"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={() => onMoveDown(section.id)}
            disabled={isLast}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Move down"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleBlurName}
          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
          className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-0 focus:outline-none focus:ring-0 px-0"
          placeholder="Section name..."
        />

        {saving && (
          <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin flex-shrink-0" />
        )}

        <button
          onClick={() => onDelete(section.id)}
          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
          title="Delete section"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Files grid */}
      <div className="p-4">
        {section.files && section.files.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-3">
            {section.files.map((sf) => {
              const file = sf.file || sf
              const fileId = sf.file_id || file.id
              const isImage = file.mime_type?.startsWith('image/')
              return (
                <div key={fileId} className="group relative">
                  <div className="aspect-square bg-stone-50 border border-stone-200 rounded overflow-hidden flex items-center justify-center">
                    {isImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`/api/files/preview/${fileId}`}
                        alt={file.original_filename || file.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileTypeIcon mimeType={file.mime_type} className="w-8 h-8" />
                    )}
                  </div>
                  <p className="text-xs text-gray-600 truncate mt-1">
                    {file.original_filename || file.filename}
                  </p>
                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveFile(fileId)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border border-stone-200 rounded-full flex items-center justify-center text-gray-400 hover:text-red-600 hover:border-red-200 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                    title="Remove from section"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-xs text-gray-400 mb-3">No files in this section</p>
        )}

        <button
          onClick={() => onOpenFilePicker(section)}
          className="inline-flex items-center gap-1 text-xs text-labor-red hover:text-labor-red/80 font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Files
        </button>
      </div>
    </div>
  )
}

export default function CollectionEditor({ collectionId }) {
  const [collection, setCollection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)
  const [addingSection, setAddingSection] = useState(false)
  const [filePickerSection, setFilePickerSection] = useState(null)

  const fetchCollection = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/collections/${collectionId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load collection')
      const col = data.collection || data
      setCollection(col)
      setName(col.name || '')
      setSlug(col.slug || '')
      setDescription(col.description || '')
      setIsPublished(col.is_published || false)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [collectionId])

  useEffect(() => {
    fetchCollection()
  }, [fetchCollection])

  const handleSaveMeta = async () => {
    if (!name.trim() || !slug.trim()) return

    setSavingMeta(true)
    try {
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          is_published: isPublished,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      const updated = data.collection || data
      setCollection(prev => ({ ...prev, ...updated }))
    } catch (err) {
      alert(`Save failed: ${err.message}`)
    } finally {
      setSavingMeta(false)
    }
  }

  const handleAddSection = async () => {
    setAddingSection(true)
    try {
      const res = await fetch(`/api/collections/${collectionId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Section' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add section')
      await fetchCollection()
    } catch (err) {
      alert(`Failed to add section: ${err.message}`)
    } finally {
      setAddingSection(false)
    }
  }

  const handleUpdateSection = async (sectionId, updates, isFileUpdate = false) => {
    try {
      if (isFileUpdate) {
        const res = await fetch(`/api/collections/${collectionId}/sections/${sectionId}/files`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to update files')
        }
      } else {
        const res = await fetch(`/api/collections/${collectionId}/sections/${sectionId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Failed to update section')
        }
      }
      await fetchCollection()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDeleteSection = async (sectionId) => {
    if (!confirm('Delete this section and all its file assignments?')) return
    try {
      const res = await fetch(`/api/collections/${collectionId}/sections/${sectionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete section')
      }
      await fetchCollection()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleMoveSection = async (sectionId, direction) => {
    const sections = collection.sections || []
    const idx = sections.findIndex(s => s.id === sectionId)
    if (idx === -1) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sections.length) return

    // Swap sort_order values
    const currentOrder = sections[idx].sort_order ?? idx
    const swapOrder = sections[swapIdx].sort_order ?? swapIdx

    try {
      await Promise.all([
        fetch(`/api/collections/${collectionId}/sections/${sections[idx].id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: swapOrder }),
        }),
        fetch(`/api/collections/${collectionId}/sections/${sections[swapIdx].id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: currentOrder }),
        }),
      ])
      await fetchCollection()
    } catch (err) {
      alert('Failed to reorder sections')
    }
  }

  const handleFilePickerSave = async (fileIds) => {
    if (!filePickerSection) return
    try {
      const res = await fetch(`/api/collections/${collectionId}/sections/${filePickerSection.id}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_ids: fileIds }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update files')
      }
      setFilePickerSection(null)
      await fetchCollection()
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-labor-red" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white border border-stone-200 rounded-lg p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={fetchCollection} className="mt-2 text-sm text-labor-red hover:underline">
            Try again
          </button>
        </div>
      </div>
    )
  }

  const sections = collection?.sections || []

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
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

      {/* Collection metadata */}
      <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-4 mb-6">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveMeta}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
              className="w-full px-3 py-1.5 text-sm bg-white border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Slug</label>
            <div className="flex items-center gap-0">
              <span className="text-sm text-gray-400 bg-stone-50 border border-r-0 border-stone-200 rounded-l px-3 py-1.5">/</span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(generateSlug(e.target.value))}
                onBlur={handleSaveMeta}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                className="w-full px-3 py-1.5 text-sm font-mono bg-white border border-stone-200 rounded-r focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSaveMeta}
              rows={2}
              className="w-full px-3 py-1.5 text-sm bg-white border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red resize-none"
              placeholder="Brief description..."
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-medium text-gray-500">Published</label>
              <p className="text-xs text-gray-400 mt-0.5">Visible on the public resources portal</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublished}
              onClick={async () => {
                const newVal = !isPublished
                setIsPublished(newVal)
                setSavingMeta(true)
                try {
                  const res = await fetch(`/api/collections/${collectionId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_published: newVal }),
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.error)
                  setCollection(prev => ({ ...prev, is_published: newVal }))
                } catch (err) {
                  setIsPublished(!newVal)
                  alert(`Failed to update: ${err.message}`)
                } finally {
                  setSavingMeta(false)
                }
              }}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                isPublished ? 'bg-labor-red' : 'bg-gray-200'
              }`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                isPublished ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>
          {savingMeta && (
            <p className="text-xs text-gray-400">Saving...</p>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Sections</h2>
        <span className="text-xs text-gray-400">{sections.length} {sections.length === 1 ? 'section' : 'sections'}</span>
      </div>

      <div className="space-y-4 mb-4">
        {sections.map((section, idx) => (
          <SectionCard
            key={section.id}
            section={section}
            onUpdate={handleUpdateSection}
            onDelete={handleDeleteSection}
            onMoveUp={(id) => handleMoveSection(id, 'up')}
            onMoveDown={(id) => handleMoveSection(id, 'down')}
            isFirst={idx === 0}
            isLast={idx === sections.length - 1}
            onOpenFilePicker={setFilePickerSection}
          />
        ))}
      </div>

      <button
        onClick={handleAddSection}
        disabled={addingSection}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50 transition-colors disabled:opacity-50"
      >
        {addingSection ? (
          <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        )}
        Add Section
      </button>

      {/* File Picker Modal */}
      {filePickerSection && (
        <FilePicker
          section={filePickerSection}
          onSave={handleFilePickerSave}
          onClose={() => setFilePickerSection(null)}
        />
      )}
    </div>
  )
}
