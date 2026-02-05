'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useCallback, useEffect, useRef } from 'react'

export default function MembersToolbar() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const debounceRef = useRef(null)

  const currentStatus = searchParams.get('status') || ''
  const currentSegment = searchParams.get('segment') || ''

  const updateParams = useCallback((updates) => {
    const params = new URLSearchParams(searchParams.toString())
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

  const hasFilters = search || currentStatus || currentSegment

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-sm border border-stone-200 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
        />
      </div>

      {/* Status filter */}
      <select
        value={currentStatus}
        onChange={(e) => updateParams({ status: e.target.value, segment: currentSegment })}
        className="px-3 py-1.5 text-sm border border-stone-200 rounded bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
      >
        <option value="">All statuses</option>
        <option value="active">Active</option>
        <option value="pending">Pending</option>
        <option value="lapsed">Lapsed</option>
        <option value="cancelled">Cancelled</option>
      </select>

      {/* Segment filter */}
      <select
        value={currentSegment}
        onChange={(e) => updateParams({ segment: e.target.value, status: currentStatus })}
        className="px-3 py-1.5 text-sm border border-stone-200 rounded bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
      >
        <option value="">All segments</option>
        <option value="donor">Donors</option>
        <option value="volunteer">Volunteers</option>
        <option value="organizer">Organizers</option>
        <option value="event_attendee">Event Attendees</option>
        <option value="new_member">New Members</option>
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
