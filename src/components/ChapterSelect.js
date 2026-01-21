'use client'

import { useState, useRef, useEffect } from 'react'

export default function ChapterSelect({ chapters, value, onChange, required = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)

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

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = (chapterId) => {
    onChange(chapterId)
    setIsOpen(false)
    setSearch('')
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected value display / trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="input-field text-left flex items-center justify-between w-full"
      >
        <span className={selectedChapter ? 'text-gray-900' : 'text-gray-400'}>
          {selectedChapter ? `${selectedChapter.name} (${selectedChapter.level})` : 'Select a chapter...'}
        </span>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

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
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chapters..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-labor-red focus:ring-1 focus:ring-labor-red"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto">
            {filteredChapters.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                No chapters found
              </div>
            ) : (
              filteredChapters.map((chapter) => (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => handleSelect(chapter.id)}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                    value === chapter.id ? 'bg-labor-red-50 text-labor-red-700' : 'text-gray-900'
                  }`}
                >
                  <span>{chapter.name}</span>
                  <span className={`text-xs ${value === chapter.id ? 'text-labor-red-500' : 'text-gray-400'}`}>
                    {chapter.level}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
