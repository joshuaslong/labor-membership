'use client'

import { useState, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const LEVEL_ORDER = ['national', 'state', 'county', 'city']
const LEVEL_COLORS = {
  national: 'text-labor-red bg-red-50 border border-red-200',
  state: 'text-blue-700 bg-blue-50 border border-blue-200',
  county: 'text-green-700 bg-green-50 border border-green-200',
  city: 'text-purple-700 bg-purple-50 border border-purple-200',
}
const LEVEL_LABELS = {
  national: 'National',
  state: 'State',
  county: 'County',
  city: 'City',
}

export default function ChapterBrowser({ chapters = [], myChapter = null }) {
  const searchParams = useSearchParams()
  const levelParam = searchParams.get('level')
  const activeLevelFilter = levelParam && LEVEL_ORDER.includes(levelParam) ? levelParam : null

  const [search, setSearch] = useState('')
  const [expandedStates, setExpandedStates] = useState(new Set())

  const { hierarchy, filteredFlat } = useMemo(() => {
    const chapterMap = {}
    chapters.forEach(c => {
      chapterMap[c.id] = { ...c, children: [] }
    })

    const roots = []
    chapters.forEach(c => {
      if (c.parent_id && chapterMap[c.parent_id]) {
        chapterMap[c.parent_id].children.push(chapterMap[c.id])
      } else if (!c.parent_id) {
        roots.push(chapterMap[c.id])
      }
    })

    const sortChildren = (node) => {
      node.children.sort((a, b) => a.name.localeCompare(b.name))
      node.children.forEach(sortChildren)
    }
    roots.forEach(sortChildren)

    const searchLower = search.toLowerCase()
    const filtered = chapters.filter(c => {
      const matchesSearch = !search || c.name.toLowerCase().includes(searchLower)
      const matchesLevel = !activeLevelFilter || c.level === activeLevelFilter
      return matchesSearch && matchesLevel
    })

    return { hierarchy: roots, filteredFlat: filtered }
  }, [chapters, search, activeLevelFilter])

  const toggleState = (stateId) => {
    setExpandedStates(prev => {
      const next = new Set(prev)
      if (next.has(stateId)) next.delete(stateId)
      else next.add(stateId)
      return next
    })
  }

  const expandAll = () => {
    setExpandedStates(new Set(chapters.filter(c => c.level === 'state').map(c => c.id)))
  }

  const collapseAll = () => setExpandedStates(new Set())

  const showFlatList = activeLevelFilter || search
  const pageTitle = activeLevelFilter ? `${LEVEL_LABELS[activeLevelFilter]} Chapters` : 'All Chapters'
  const displayCount = showFlatList ? filteredFlat.length : chapters.length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* My Chapter card */}
      {myChapter && !showFlatList && (
        <Link
          href={`/workspace/chapters/${myChapter.id}`}
          className="block bg-white border border-stone-200 rounded px-4 py-3 mb-4 hover:bg-stone-50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">My Chapter</span>
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[myChapter.level]}`}>
                {LEVEL_LABELS[myChapter.level]}
              </span>
              <span className="text-sm font-medium text-gray-900">{myChapter.name}</span>
            </div>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      )}

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{pageTitle}</h1>
        <span className="text-xs text-gray-400 tabular-nums">
          {displayCount} chapter{displayCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="Search chapters..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border border-stone-200 rounded px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 focus:border-gray-300"
        />
      </div>

      {/* Expand/Collapse */}
      {!showFlatList && hierarchy.length > 0 && (
        <div className="flex gap-2 mb-3">
          <button onClick={expandAll} className="text-xs text-gray-500 hover:text-gray-700">
            Expand all
          </button>
          <span className="text-gray-300">|</span>
          <button onClick={collapseAll} className="text-xs text-gray-500 hover:text-gray-700">
            Collapse all
          </button>
        </div>
      )}

      {/* Chapter List */}
      <div className="bg-white border border-stone-200 rounded overflow-hidden">
        {showFlatList ? (
          filteredFlat.length > 0 ? (
            <div className="divide-y divide-stone-100">
              {filteredFlat.map(chapter => (
                <ChapterRow key={chapter.id} chapter={chapter} myChapterId={myChapter?.id} />
              ))}
            </div>
          ) : (
            <div className="px-4 py-12 text-center text-sm text-gray-500">
              No chapters match your search.
            </div>
          )
        ) : (
          hierarchy.length > 0 ? (
            <div className="divide-y divide-stone-100">
              {hierarchy.map(root => (
                <div key={root.id}>
                  <ChapterRow chapter={root} myChapterId={myChapter?.id} />
                  {root.children.map(state => (
                    <StateAccordion
                      key={state.id}
                      state={state}
                      isExpanded={expandedStates.has(state.id)}
                      onToggle={() => toggleState(state.id)}
                      myChapterId={myChapter?.id}
                    />
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-12 text-center text-sm text-gray-500">
              No chapters found.
            </div>
          )
        )}
      </div>
    </div>
  )
}

function ChapterRow({ chapter, myChapterId, indent = 0 }) {
  const isMine = chapter.id === myChapterId

  return (
    <Link
      href={`/workspace/chapters/${chapter.id}`}
      className="flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
      style={indent ? { paddingLeft: `${16 + indent * 24}px` } : undefined}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${LEVEL_COLORS[chapter.level]}`}>
          {LEVEL_LABELS[chapter.level]}
        </span>
        <span className="text-sm font-medium text-gray-900 truncate">{chapter.name}</span>
        {isMine && (
          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-stone-100 text-gray-600 shrink-0">You</span>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <span className="text-xs text-gray-400 tabular-nums">
          {chapter.memberCount || 0}
        </span>
        <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}

function StateAccordion({ state, isExpanded, onToggle, myChapterId }) {
  const hasChildren = state.children.length > 0
  const isMine = state.id === myChapterId

  return (
    <div className="border-t border-stone-100 first:border-t-0">
      <div className="flex items-center">
        {hasChildren ? (
          <button type="button" onClick={onToggle} className="w-8 flex items-center justify-center py-3 hover:bg-stone-50">
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ) : (
          <div className="w-8" />
        )}
        <Link
          href={`/workspace/chapters/${state.id}`}
          className="flex-1 flex items-center justify-between py-3 pr-4 hover:bg-stone-50 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${LEVEL_COLORS[state.level]}`}>
              {LEVEL_LABELS[state.level]}
            </span>
            <span className="text-sm font-medium text-gray-900 truncate">{state.name}</span>
            {isMine && (
              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-stone-100 text-gray-600 shrink-0">You</span>
            )}
            {hasChildren && (
              <span className="text-xs text-gray-400 shrink-0">{state.children.length}</span>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <span className="text-xs text-gray-400 tabular-nums">
              {state.memberCount || 0}
            </span>
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

      {isExpanded && hasChildren && (
        <div className="border-t border-stone-100">
          {state.children.map(child => (
            <ChildChapter key={child.id} chapter={child} depth={1} myChapterId={myChapterId} />
          ))}
        </div>
      )}
    </div>
  )
}

function ChildChapter({ chapter, depth, myChapterId }) {
  const isMine = chapter.id === myChapterId

  return (
    <div>
      <Link
        href={`/workspace/chapters/${chapter.id}`}
        className="flex items-center justify-between py-2.5 pr-4 hover:bg-stone-50 transition-colors border-t border-stone-50 first:border-t-0"
        style={{ paddingLeft: `${32 + depth * 20}px` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-5 h-5 rounded flex items-center justify-center text-xs font-medium shrink-0 ${LEVEL_COLORS[chapter.level]}`}>
            {LEVEL_LABELS[chapter.level]?.charAt(0)}
          </span>
          <span className="text-sm text-gray-700 truncate">{chapter.name}</span>
          {isMine && (
            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-stone-100 text-gray-600 shrink-0">You</span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <span className="text-xs text-gray-400 tabular-nums">{chapter.memberCount || 0}</span>
          <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>
      {chapter.children?.map(child => (
        <ChildChapter key={child.id} chapter={child} depth={depth + 1} myChapterId={myChapterId} />
      ))}
    </div>
  )
}
