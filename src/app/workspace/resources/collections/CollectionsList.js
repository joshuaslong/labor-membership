'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

export default function CollectionsList({ isTopAdmin = false }) {
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('chapter') // 'national' | 'chapter'

  const fetchCollections = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (isTopAdmin && tab === 'national') {
        params.set('scope', 'national')
      }
      const res = await fetch(`/api/collections?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load collections')
      setCollections(data.collections || data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [isTopAdmin, tab])

  useEffect(() => {
    fetchCollections()
  }, [fetchCollections])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Collections</h1>
          {!loading && (
            <p className="text-xs text-gray-500 mt-0.5">
              {collections.length} {collections.length === 1 ? 'collection' : 'collections'}
            </p>
          )}
        </div>
        <Link
          href="/workspace/resources/collections/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-labor-red hover:bg-labor-red/90 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Collection
        </Link>
      </div>

      {/* Tab toggle for top admins */}
      {isTopAdmin && (
        <div className="flex gap-1 mb-4 bg-stone-100 rounded p-0.5 w-fit">
          <button
            onClick={() => setTab('chapter')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              tab === 'chapter'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Chapter
          </button>
          <button
            onClick={() => setTab('national')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              tab === 'national'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            National
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-labor-red" />
        </div>
      ) : error ? (
        <div className="bg-white border border-stone-200 rounded-lg p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={fetchCollections} className="mt-2 text-sm text-labor-red hover:underline">
            Try again
          </button>
        </div>
      ) : collections.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-lg p-12 text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-sm text-gray-500 mb-1">No collections yet</p>
          <Link href="/workspace/resources/collections/new" className="text-sm text-labor-red hover:underline">
            Create your first collection
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((collection) => (
            <Link
              key={collection.id}
              href={`/workspace/resources/collections/${collection.id}`}
              className="bg-white border border-stone-200 rounded-lg shadow-sm p-4 hover:border-stone-300 hover:shadow transition-all group"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-900 group-hover:text-labor-red transition-colors truncate">
                  {collection.name}
                </h3>
                <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 flex-shrink-0 mt-0.5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              {collection.slug && (
                <p className="text-xs text-gray-400 font-mono mb-1.5">/{collection.slug}</p>
              )}
              {collection.description && (
                <p className="text-xs text-gray-500 line-clamp-2 mb-3">{collection.description}</p>
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  {collection.section_count ?? collection.sections?.length ?? 0} {(collection.section_count ?? collection.sections?.length ?? 0) === 1 ? 'section' : 'sections'}
                </span>
                {collection.chapter_id === null && (
                  <span className="text-xs bg-stone-100 text-gray-500 px-1.5 py-0.5 rounded">National</span>
                )}
                {collection.is_published ? (
                  <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">Published</span>
                ) : (
                  <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">Draft</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
