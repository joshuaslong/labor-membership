'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useCallback, useEffect, useRef } from 'react'

export default function EventsToolbar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const debounceRef = useRef(null)

  const currentStatus = searchParams.get('status') || ''
  const currentTime = searchParams.get('time') || ''

  const updateParams = useCallback((updates) => {
    const params = new URLSearchParams(searchParams.toString())
    // Reset to page 1 when any filter changes
    params.delete('page')
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    })
    const query = params.toString()
    router.push(query ? `${pathname}?${query}` : pathname)
  }, [router, pathname, searchParams])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const currentSearch = searchParams.get('search') || ''
      if (search !== currentSearch) {
        updateParams({ search: search || '' })
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [search, searchParams, updateParams])

  const clearAll = () => {
    setSearch('')
    router.push(pathname)
  }

  const hasFilters = search || currentStatus || currentTime

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search events..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-sm border border-stone-200 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
        />
      </div>

      {/* Status filter */}
      <select
        value={currentStatus}
        onChange={(e) => updateParams({ status: e.target.value })}
        className="px-3 py-1.5 text-sm border border-stone-200 rounded bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
      >
        <option value="">All statuses</option>
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        <option value="cancelled">Cancelled</option>
      </select>

      {/* Time filter */}
      <select
        value={currentTime}
        onChange={(e) => updateParams({ time: e.target.value })}
        className="px-3 py-1.5 text-sm border border-stone-200 rounded bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
      >
        <option value="">All time</option>
        <option value="upcoming">Upcoming</option>
        <option value="past">Past</option>
      </select>

      {/* Clear filters */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
