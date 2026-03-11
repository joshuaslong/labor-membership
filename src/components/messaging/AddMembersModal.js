'use client'

import { useState, useEffect } from 'react'

export default function AddMembersModal({ isOpen, onClose, channelId, chapterId }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      setResults([])
      setSelected([])
      setError(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (search.length < 2) {
      setResults([])
      return
    }
    const timeout = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/workspace/messaging/team-members?search=${encodeURIComponent(search)}&chapter_id=${chapterId}`)
        if (res.ok) {
          const data = await res.json()
          const selectedIds = new Set(selected.map(m => m.id))
          setResults(data.filter(m => !selectedIds.has(m.id)))
        }
      } catch { /* ignore */ }
      setSearching(false)
    }, 300)
    return () => clearTimeout(timeout)
  }, [search, chapterId, selected])

  if (!isOpen) return null

  const addMember = (member) => {
    setSelected(prev => [...prev, member])
    setSearch('')
    setResults([])
  }

  const removeMember = (id) => {
    setSelected(prev => prev.filter(m => m.id !== id))
  }

  const handleSubmit = async () => {
    if (selected.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/workspace/messaging/channels/${channelId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_member_ids: selected.map(m => m.id) }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to add members')
      }
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded border border-stone-200 shadow-lg w-full max-w-md mx-4">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Add Members</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</div>
          )}

          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search team members..."
            className="w-full border border-stone-200 rounded px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-stone-400"
            autoFocus
          />

          {results.length > 0 && (
            <div className="border border-stone-200 rounded bg-white max-h-40 overflow-y-auto">
              {results.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => addMember(m)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 text-gray-900"
                >
                  {m.first_name} {m.last_name}
                </button>
              ))}
            </div>
          )}
          {searching && <p className="text-xs text-gray-400">Searching...</p>}

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map(m => (
                <span key={m.id} className="inline-flex items-center gap-1 bg-stone-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                  {m.first_name} {m.last_name}
                  <button type="button" onClick={() => removeMember(m.id)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || selected.length === 0}
              className="px-4 py-1.5 text-sm font-medium bg-labor-red text-white rounded hover:bg-labor-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Adding...' : `Add ${selected.length > 0 ? `(${selected.length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
