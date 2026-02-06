'use client'

import { useState, useRef, useEffect } from 'react'

export default function ChapterSelect({ chapters, value, onChange, required = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)

  const selectedChapter = chapters.find(c => c.id === value)

  const filteredChapters = chapters.filter(chapter =>
    chapter.name.toLowerCase().includes(search.toLowerCase()) ||
    chapter.level.toLowerCase().includes(search.toLowerCase())
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (chapterId) => {
    onChange(chapterId)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Search input that also shows selected value */}
      <div className="relative">
        <input
          type="text"
          value={isOpen ? search : (selectedChapter ? selectedChapter.name : '')}
          onChange={(e) => {
            setSearch(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => {
            setIsOpen(true)
            setSearch('')
          }}
          placeholder="Select chapter..."
          className="input-field pr-8 text-sm"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <svg
            className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Hidden input for form validation */}
      {required && (
        <input
          type="text"
          value={value || ''}
          onChange={() => {}}
          required
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredChapters.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500">
              No chapters found
            </div>
          ) : (
            filteredChapters.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => handleSelect(chapter.id)}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${
                  value === chapter.id ? 'bg-labor-red-50 text-labor-red' : 'text-gray-700'
                }`}
              >
                {chapter.name} <span className="text-gray-400">({chapter.level})</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
