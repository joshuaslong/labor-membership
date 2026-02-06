'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const levelOrder = ['national', 'state', 'county', 'city']
const levelLabels = { national: 'National', state: 'State', county: 'County', city: 'City' }

export default function ChapterSwitcher({ chapters, selectedChapterId, showAll }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)
  const searchRef = useRef(null)

  // Don't render if user only has one chapter and no "all" option
  if (!showAll && chapters.length <= 1) return null

  const selected = selectedChapterId === 'all'
    ? null
    : chapters.find(c => c.id === selectedChapterId)

  const displayName = selected?.name || 'All Chapters'

  const filtered = search
    ? chapters.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.level.toLowerCase().includes(search.toLowerCase())
      )
    : chapters

  // Group by level
  const grouped = levelOrder
    .map(level => ({
      level,
      label: levelLabels[level],
      items: filtered.filter(c => c.level === level)
    }))
    .filter(g => g.items.length > 0)

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = async (id) => {
    setLoading(true)
    setIsOpen(false)
    setSearch('')
    try {
      await fetch('/api/workspace/set-chapter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterId: id }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-stone-50 border border-stone-200 rounded hover:bg-stone-100 transition-colors disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008V7.5z" />
        </svg>
        <span className="max-w-[160px] truncate">{loading ? 'Switching...' : displayName}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-1 w-72 bg-white border border-stone-200 rounded shadow-lg">
          {/* Search */}
          {chapters.length > 5 && (
            <div className="p-2 border-b border-stone-100">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chapters..."
                className="w-full px-2 py-1.5 text-xs border border-stone-200 rounded focus:outline-none focus:border-stone-300"
              />
            </div>
          )}

          <div className="max-h-64 overflow-y-auto py-1">
            {/* All Chapters option */}
            {showAll && !search && (
              <button
                onClick={() => handleSelect('all')}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-stone-50 transition-colors ${
                  selectedChapterId === 'all'
                    ? 'bg-stone-50 text-gray-900 font-medium'
                    : 'text-gray-700'
                }`}
              >
                All Chapters
              </button>
            )}

            {/* Grouped chapter list */}
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">No chapters found</div>
            ) : (
              grouped.map(group => (
                <div key={group.level}>
                  <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {group.label}
                  </div>
                  {group.items.map(chapter => (
                    <button
                      key={chapter.id}
                      onClick={() => handleSelect(chapter.id)}
                      className={`w-full px-3 py-1.5 text-left text-sm hover:bg-stone-50 transition-colors ${
                        selectedChapterId === chapter.id
                          ? 'bg-stone-50 text-labor-red font-medium'
                          : 'text-gray-700'
                      }`}
                    >
                      {chapter.name}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
