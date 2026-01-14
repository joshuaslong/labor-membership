'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const LEVEL_ORDER = ['national', 'state', 'county', 'city']
const LEVEL_COLORS = {
  national: 'bg-labor-red text-white',
  state: 'bg-blue-600 text-white',
  county: 'bg-green-600 text-white',
  city: 'bg-purple-600 text-white',
}

export default function ChaptersPage() {
  const [chapters, setChapters] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [levelFilter, setLevelFilter] = useState('all')
  const [expandedStates, setExpandedStates] = useState(new Set())

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()

      // Check if current user is an admin
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: adminUser } = await supabase
          .from('admin_users')
          .select('role')
          .eq('user_id', user.id)
          .single()
        setIsAdmin(!!adminUser)
      }

      // Fetch chapters
      const res = await fetch('/api/chapters')
      const data = await res.json()
      setChapters(data.chapters || [])
      setLoading(false)
    }

    loadData()
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

  const ChapterRow = ({ chapter, indent = 0 }) => (
    <Link
      href={'/chapters/' + chapter.id}
      className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
      style={{ marginLeft: indent * 24 }}
    >
      <span className={'px-2 py-1 rounded text-xs font-medium ' + LEVEL_COLORS[chapter.level]}>
        {chapter.level}
      </span>
      <span className="font-medium text-gray-900 flex-1">{chapter.name}</span>
      {isAdmin && (
        <span className="text-gray-500 text-sm">
          {chapter.memberCount} member{chapter.memberCount !== 1 ? 's' : ''}
          {chapter.primaryCount > 0 && chapter.primaryCount !== chapter.memberCount && (
            <span className="text-gray-400 ml-1">
              ({chapter.primaryCount} direct)
            </span>
          )}
        </span>
      )}
    </Link>
  )

  const StateAccordion = ({ state }) => {
    const isExpanded = expandedStates.has(state.id)
    const hasChildren = state.children.length > 0

    const handleToggle = (e) => {
      e.preventDefault()
      e.stopPropagation()
      toggleState(state.id)
    }

    return (
      <div className="mb-2">
        <div className="flex items-center gap-2">
          {hasChildren && (
            <button
              type="button"
              onClick={handleToggle}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <svg
                className={'w-4 h-4 text-gray-500 transition-transform ' + (isExpanded ? 'rotate-90' : '')}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
          <div className={'flex-1 ' + (!hasChildren ? 'ml-6' : '')}>
            <ChapterRow chapter={state} />
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div className="mt-2 space-y-2">
            {state.children.map(child => (
              <ChapterWithChildren key={child.id} chapter={child} depth={1} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const ChapterWithChildren = ({ chapter, depth }) => (
    <div className={depth > 0 ? 'ml-6 pl-4 border-l-2 border-gray-200 space-y-2' : 'space-y-2'}>
      <ChapterRow chapter={chapter} indent={0} />
      {chapter.children.map(child => (
        <ChapterWithChildren key={child.id} chapter={child} depth={depth + 1} />
      ))}
    </div>
  )

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-12 text-center">Loading chapters...</div>
  }

  // When filtering by level or search, show flat list
  const showFlatList = levelFilter !== 'all' || search

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Chapters</h1>
          <p className="text-gray-600">Browse the chapter hierarchy</p>
        </div>
        {isAdmin && (
          <Link href="/admin/chapters/new" className="btn-primary">
            Create Chapter
          </Link>
        )}
      </div>

      {/* Search and Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <input
            type="text"
            placeholder="Search chapters..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field flex-1"
          />
          <div className="flex gap-2 flex-wrap">
            {['all', ...LEVEL_ORDER].map(level => (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={'px-3 py-1 rounded text-sm font-medium transition-colors ' + (
                  levelFilter === level
                    ? (level === 'all' ? 'bg-gray-800 text-white' : LEVEL_COLORS[level])
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                {level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
                <span className="ml-1 opacity-75">({counts[level] || 0})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Expand/Collapse controls for hierarchy view */}
      {!showFlatList && hierarchy.length > 0 && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={expandAll}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Expand all states
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={collapseAll}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Collapse all
          </button>
        </div>
      )}

      {/* Chapter List */}
      <div className="space-y-2">
        {showFlatList ? (
          // Flat filtered list
          filteredFlat.length > 0 ? (
            filteredFlat.map(chapter => (
              <div key={chapter.id} className="mb-2">
                <ChapterRow chapter={chapter} />
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-8">No chapters match your search.</p>
          )
        ) : (
          // Hierarchical view with collapsible states
          hierarchy.length > 0 ? (
            hierarchy.map(root => (
              <div key={root.id}>
                {/* National chapter */}
                <div className="mb-4">
                  <ChapterRow chapter={root} />
                </div>
                {/* State chapters as accordions */}
                <div className="space-y-2">
                  {root.children.map(state => (
                    <StateAccordion key={state.id} state={state} />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-8">No chapters yet. Create one to get started.</p>
          )
        )}
      </div>
    </div>
  )
}
