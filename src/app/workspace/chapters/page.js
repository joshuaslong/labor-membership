'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

const LEVEL_ORDER = ['national', 'state', 'county', 'city']
const LEVEL_COLORS = {
  national: 'bg-labor-red text-white',
  state: 'bg-blue-600 text-white',
  county: 'bg-green-600 text-white',
  city: 'bg-purple-600 text-white',
}
const LEVEL_LABELS = {
  national: 'National',
  state: 'State',
  county: 'County',
  city: 'City',
}

export default function WorkspaceChaptersPage() {
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [expandedStates, setExpandedStates] = useState(new Set())

  useEffect(() => {
    const loadChapters = async () => {
      const res = await fetch('/api/chapters')
      const data = await res.json()
      setChapters(data.chapters || [])
      setLoading(false)
    }
    loadChapters()
  }, [])

  // Build hierarchy and apply filters
  const { hierarchy, filteredFlat, counts } = useMemo(() => {
    // Count chapters by level
    const counts = { all: chapters.length }
    chapters.forEach(c => {
      counts[c.level] = (counts[c.level] || 0) + 1
    })

    // Build a map for hierarchy
    const chapterMap = {}
    chapters.forEach(c => {
      chapterMap[c.id] = { ...c, children: [] }
    })

    // Build parent-child relationships
    const roots = []
    chapters.forEach(c => {
      if (c.parent_id && chapterMap[c.parent_id]) {
        chapterMap[c.parent_id].children.push(chapterMap[c.id])
      } else if (!c.parent_id) {
        roots.push(chapterMap[c.id])
      }
    })

    // Sort children by name
    const sortChildren = (node) => {
      node.children.sort((a, b) => a.name.localeCompare(b.name))
      node.children.forEach(sortChildren)
    }
    roots.forEach(sortChildren)

    // Filter chapters
    const searchLower = search.toLowerCase()
    const filtered = chapters.filter(c => {
      const matchesSearch = !search || c.name.toLowerCase().includes(searchLower)
      const matchesLevel = levelFilter === 'all' || c.level === levelFilter
      return matchesSearch && matchesLevel
    })

    return { hierarchy: roots, filteredFlat: filtered, counts }
  }, [chapters, search, levelFilter])

  const toggleState = (stateId) => {
    setExpandedStates(prev => {
      const next = new Set(prev)
      if (next.has(stateId)) {
        next.delete(stateId)
      } else {
        next.add(stateId)
      }
      return next
    })
  }

  const expandAll = () => {
    const allStateIds = chapters.filter(c => c.level === 'state').map(c => c.id)
    setExpandedStates(new Set(allStateIds))
  }

  const collapseAll = () => {
    setExpandedStates(new Set())
  }

  // When filtering by level or search, show flat list
  const showFlatList = levelFilter !== 'all' || search

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Chapters</h1>
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-8 text-center text-gray-500">
          Loading chapters...
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Chapters</h1>
        <span className="text-xs text-gray-400 tabular-nums">
          {chapters.length} chapter{chapters.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-stone-200 rounded-lg p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search chapters..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field text-sm"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {['all', ...LEVEL_ORDER].map(level => (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  levelFilter === level
                    ? (level === 'all' ? 'bg-gray-800 text-white' : LEVEL_COLORS[level])
                    : 'bg-stone-100 text-gray-600 hover:bg-stone-200'
                }`}
              >
                {level === 'all' ? 'All' : LEVEL_LABELS[level]}
                <span className="ml-1 opacity-75">({counts[level] || 0})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Expand/Collapse controls for hierarchy view */}
      {!showFlatList && hierarchy.length > 0 && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={expandAll}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Expand all
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={collapseAll}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Collapse all
          </button>
        </div>
      )}

      {/* Chapter List */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        {showFlatList ? (
          // Flat filtered list
          filteredFlat.length > 0 ? (
            <div className="divide-y divide-stone-100">
              {filteredFlat.map(chapter => (
                <ChapterRow key={chapter.id} chapter={chapter} />
              ))}
            </div>
          ) : (
            <div className="px-4 py-12 text-center text-gray-500">
              No chapters match your search.
            </div>
          )
        ) : (
          // Hierarchical view with collapsible states
          hierarchy.length > 0 ? (
            <div className="divide-y divide-stone-100">
              {hierarchy.map(root => (
                <div key={root.id}>
                  {/* National chapter */}
                  <ChapterRow chapter={root} />

                  {/* State chapters as accordions */}
                  {root.children.map(state => (
                    <StateAccordion
                      key={state.id}
                      state={state}
                      isExpanded={expandedStates.has(state.id)}
                      onToggle={() => toggleState(state.id)}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-12 text-center text-gray-500">
              No chapters found.
            </div>
          )
        )}
      </div>
    </div>
  )
}

function ChapterRow({ chapter, indent = 0 }) {
  return (
    <Link
      href={`/chapters/${chapter.id}`}
      className="flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
      style={{ paddingLeft: `${16 + indent * 24}px` }}
    >
      <div className="flex items-center gap-3">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[chapter.level]}`}>
          {LEVEL_LABELS[chapter.level]}
        </span>
        <span className="text-sm font-medium text-gray-900">{chapter.name}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-500 tabular-nums">
          {chapter.memberCount || 0} member{(chapter.memberCount || 0) !== 1 ? 's' : ''}
        </span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}

function StateAccordion({ state, isExpanded, onToggle }) {
  const hasChildren = state.children.length > 0

  return (
    <div className="border-t border-stone-100 first:border-t-0">
      <div className="flex items-center">
        {hasChildren && (
          <button
            type="button"
            onClick={onToggle}
            className="p-3 hover:bg-stone-50"
          >
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        <Link
          href={`/chapters/${state.id}`}
          className={`flex-1 flex items-center justify-between py-3 pr-4 hover:bg-stone-50 transition-colors ${!hasChildren ? 'pl-10' : ''}`}
        >
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[state.level]}`}>
              {LEVEL_LABELS[state.level]}
            </span>
            <span className="text-sm font-medium text-gray-900">{state.name}</span>
            {hasChildren && (
              <span className="text-xs text-gray-400">
                ({state.children.length} sub-chapter{state.children.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500 tabular-nums">
              {state.memberCount || 0} member{(state.memberCount || 0) !== 1 ? 's' : ''}
            </span>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

      {isExpanded && hasChildren && (
        <div className="bg-stone-50 border-t border-stone-100">
          {state.children.map(child => (
            <ChapterWithChildren key={child.id} chapter={child} depth={1} />
          ))}
        </div>
      )}
    </div>
  )
}

function ChapterWithChildren({ chapter, depth }) {
  return (
    <div>
      <Link
        href={`/chapters/${chapter.id}`}
        className="flex items-center justify-between py-2.5 pr-4 hover:bg-stone-100 transition-colors border-t border-stone-100 first:border-t-0"
        style={{ paddingLeft: `${40 + depth * 16}px` }}
      >
        <div className="flex items-center gap-2">
          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[chapter.level]}`}>
            {LEVEL_LABELS[chapter.level]?.charAt(0)}
          </span>
          <span className="text-sm text-gray-700">{chapter.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 tabular-nums">
            {chapter.memberCount || 0}
          </span>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>
      {chapter.children?.map(child => (
        <ChapterWithChildren key={child.id} chapter={child} depth={depth + 1} />
      ))}
    </div>
  )
}
