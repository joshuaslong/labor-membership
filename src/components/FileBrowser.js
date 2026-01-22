'use client'

import { useState, useEffect, useCallback } from 'react'

const BUCKET_LABELS = {
  'public': 'Public Files',
  'chapters': 'Chapter Documents',
  'media/social': 'Social Media',
  'media/podcast': 'Podcast',
  'internal-docs': 'Internal Documents',
}

const FILE_ICONS = {
  'image/': '\ud83d\uddbc\ufe0f',
  'video/': '\ud83c\udfac',
  'audio/': '\ud83c\udfb5',
  'application/pdf': '\ud83d\udcc4',
  'application/': '\ud83d\udcce',
  'text/': '\ud83d\udcdd',
  'default': '\ud83d\udcc1',
}

function getFileIcon(mimeType) {
  if (!mimeType) return FILE_ICONS.default
  for (const [prefix, icon] of Object.entries(FILE_ICONS)) {
    if (prefix !== 'default' && mimeType.startsWith(prefix)) return icon
  }
  return FILE_ICONS.default
}

function formatFileSize(bytes) {
  if (!bytes) return 'Unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export default function FileBrowser({
  allowedBuckets = ['public'],
  chapterId = null,
  onFileSelect = null,
  showDelete = true,
}) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedBucket, setSelectedBucket] = useState(allowedBuckets[0])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        bucket: selectedBucket,
        page: page.toString(),
        limit: '20',
      })
      if (chapterId) params.set('chapter_id', chapterId)
      if (search) params.set('search', search)

      const res = await fetch(`/api/files?${params}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setFiles(data.files)
      setTotalPages(data.pagination.totalPages)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedBucket, page, search, chapterId])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const handleSearch = (e) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleDownload = async (file) => {
    try {
      const res = await fetch(`/api/files/download/${file.id}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      // Open download URL in new tab
      window.open(data.url, '_blank')
    } catch (err) {
      alert(`Download failed: ${err.message}`)
    }
  }

  const handleDelete = async (file) => {
    if (!confirm(`Delete "${file.original_filename}"?`)) return

    try {
      const res = await fetch(`/api/files/${file.id}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      fetchFiles()
    } catch (err) {
      alert(`Delete failed: ${err.message}`)
    }
  }

  return (
    <div className="space-y-4">
      {/* Bucket Tabs */}
      {allowedBuckets.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {allowedBuckets.map(bucket => (
            <button
              key={bucket}
              onClick={() => { setSelectedBucket(bucket); setPage(1); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedBucket === bucket
                  ? 'bg-labor-red text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {BUCKET_LABELS[bucket] || bucket}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search files..."
          className="flex-1 input-field"
        />
        <button type="submit" className="btn-primary">
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}
            className="btn-secondary"
          >
            Clear
          </button>
        )}
      </form>

      {/* File List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading files...</p>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-600 bg-red-50 rounded-lg p-4">
          {error}
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-2">\ud83d\udcc2</div>
          <p className="text-gray-500">No files found</p>
          {search && (
            <button
              onClick={() => { setSearch(''); setSearchInput(''); }}
              className="mt-2 text-labor-red hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {files.map(file => (
            <div
              key={file.id}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-2xl flex-shrink-0">
                  {getFileIcon(file.mime_type)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate" title={file.original_filename}>
                    {file.original_filename}
                  </div>
                  <div className="text-sm text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                    <span>{formatFileSize(file.file_size_bytes)}</span>
                    <span>{new Date(file.uploaded_at).toLocaleDateString()}</span>
                    {file.chapters && <span className="text-gray-400">{file.chapters.name}</span>}
                    {file.uploader_name && (
                      <span className="text-gray-400">by {file.uploader_name}</span>
                    )}
                  </div>
                  {file.description && (
                    <div className="text-sm text-gray-400 truncate mt-1">{file.description}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0 ml-4">
                {onFileSelect && (
                  <button
                    onClick={() => onFileSelect(file)}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded font-medium"
                  >
                    Select
                  </button>
                )}
                <button
                  onClick={() => handleDownload(file)}
                  className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-medium"
                >
                  Download
                </button>
                {showDelete && (
                  <button
                    onClick={() => handleDelete(file)}
                    className="px-3 py-1.5 text-sm bg-red-50 text-red-700 hover:bg-red-100 rounded font-medium"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
