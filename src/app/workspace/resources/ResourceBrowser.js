'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import MoveToFolderModal from './MoveToFolderModal'
import FolderTree from './FolderTree'

const BUCKET_LABELS = {
  'public': 'Public Files',
  'chapters': 'Chapter Documents',
  'media/social': 'Social Media',
  'media/podcast': 'Podcast',
  'internal-docs': 'Internal Documents',
}

function formatFileSize(bytes) {
  if (!bytes) return 'Unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now - d
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

function FileTypeIcon({ mimeType, className = 'w-5 h-5' }) {
  if (!mimeType) {
    return (
      <svg className={`${className} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    )
  }

  if (mimeType.startsWith('image/')) {
    return (
      <svg className={`${className} text-emerald-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  }
  if (mimeType.startsWith('video/')) {
    return (
      <svg className={`${className} text-purple-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    )
  }
  if (mimeType.startsWith('audio/')) {
    return (
      <svg className={`${className} text-blue-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    )
  }
  if (mimeType === 'application/pdf') {
    return (
      <svg className={`${className} text-red-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-6 3h4" />
      </svg>
    )
  }

  return (
    <svg className={`${className} text-gray-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

function ImagePreview({ fileId, filename }) {
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  if (error) {
    return (
      <div className="w-10 h-10 bg-gray-50 rounded flex items-center justify-center flex-shrink-0">
        <FileTypeIcon mimeType="image/" className="w-5 h-5" />
      </div>
    )
  }

  return (
    <div className="w-10 h-10 relative rounded overflow-hidden flex-shrink-0 bg-gray-50">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/files/preview/${fileId}`}
        alt={filename}
        className="w-full h-full object-cover"
        onLoad={() => setLoading(false)}
        onError={() => { setError(true); setLoading(false) }}
      />
    </div>
  )
}

function FilePreviewModal({ file, onClose, onDownload, onDelete }) {
  const overlayRef = useRef(null)
  const isImage = file?.mime_type?.startsWith('image/')
  const [imgLoading, setImgLoading] = useState(true)
  const [imgError, setImgError] = useState(false)

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!file) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <div className="min-w-0 flex-1 mr-4">
            <h2 className="text-sm font-semibold text-gray-900 truncate">{file.original_filename}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-500">{formatFileSize(file.file_size_bytes)}</span>
              <span className="text-xs text-gray-300">&middot;</span>
              <span className="text-xs text-gray-500">{formatDate(file.uploaded_at)}</span>
              {file.uploader_name && file.uploader_name !== 'Unknown' && (
                <>
                  <span className="text-xs text-gray-300">&middot;</span>
                  <span className="text-xs text-gray-400">by {file.uploader_name}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto">
          {isImage ? (
            <div className="flex items-center justify-center p-4 min-h-[300px] bg-stone-50">
              {imgLoading && !imgError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-labor-red rounded-full animate-spin" />
                </div>
              )}
              {imgError ? (
                <div className="text-center py-12">
                  <FileTypeIcon mimeType="image/" className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Preview unavailable</p>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/files/preview/${file.id}`}
                  alt={file.original_filename}
                  className="max-w-full max-h-[60vh] object-contain rounded"
                  onLoad={() => setImgLoading(false)}
                  onError={() => { setImgError(true); setImgLoading(false) }}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-8 bg-stone-50">
              <div className="w-16 h-16 bg-white rounded-lg border border-stone-200 flex items-center justify-center mb-4">
                <FileTypeIcon mimeType={file.mime_type} className="w-8 h-8" />
              </div>
              <p className="text-sm text-gray-600 font-medium">{file.original_filename}</p>
              <p className="text-xs text-gray-400 mt-1">{file.mime_type || 'Unknown type'}</p>
            </div>
          )}

          {/* Details */}
          {(file.description || file.chapters || file.bucket_prefix) && (
            <div className="px-5 py-3 border-t border-stone-100 space-y-1.5">
              {file.description && (
                <p className="text-sm text-gray-600">{file.description}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {file.bucket_prefix && (
                  <span className="text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                    {BUCKET_LABELS[file.bucket_prefix] || file.bucket_prefix}
                  </span>
                )}
                {file.chapters && (
                  <span className="text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                    {file.chapters.name}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-stone-200">
          <button
            onClick={() => { onDelete(file); onClose() }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
          <button
            onClick={() => onDownload(file)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-labor-red hover:bg-red-700 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </button>
        </div>
      </div>
    </div>
  )
}

function FolderBreadcrumbs({ folderId, chapterId }) {
  const [path, setPath] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!folderId || !chapterId) {
      setPath([])
      setLoading(false)
      return
    }

    async function buildPath() {
      setLoading(true)
      try {
        // Walk up the tree to build breadcrumb path
        const crumbs = []
        let currentId = folderId

        while (currentId) {
          const params = new URLSearchParams({ chapter_id: chapterId })
          // Fetch the folder by getting all folders at the parent level
          // We need to find the current folder's info
          const res = await fetch(`/api/folders?${params}&parent_id=__all__`)

          // Since the API doesn't have a single-folder GET, we need to iterate
          // For now, fetch all root and find, or use the [id] endpoint if it exists
          const singleRes = await fetch(`/api/folders/${currentId}`)
          if (!singleRes.ok) break

          const data = await singleRes.json()
          const folder = data.folder
          if (!folder) break

          crumbs.unshift({ id: folder.id, name: folder.name })
          currentId = folder.parent_id
        }

        setPath(crumbs)
      } catch {
        setPath([])
      } finally {
        setLoading(false)
      }
    }

    buildPath()
  }, [folderId, chapterId])

  if (loading || (!folderId && path.length === 0)) return null

  return (
    <nav className="flex items-center gap-1 text-sm mb-3 flex-wrap">
      <Link
        href="/workspace/resources"
        className="text-gray-500 hover:text-gray-700 transition-colors"
      >
        All Files
      </Link>
      {path.map((crumb) => (
        <span key={crumb.id} className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {crumb.id === folderId ? (
            <span className="text-gray-900 font-medium">{crumb.name}</span>
          ) : (
            <Link
              href={`/workspace/resources?folder=${crumb.id}`}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              {crumb.name}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

export default function ResourceBrowser({ allowedBuckets = ['public'], chapterId = null, folderId = null, isTopAdmin = false }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const bucketParam = searchParams.get('bucket')

  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [deleting, setDeleting] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [moveFile, setMoveFile] = useState(null)

  const activeBucket = bucketParam && allowedBuckets.includes(bucketParam) ? bucketParam : null
  const pageTitle = folderId ? 'Folder' : (activeBucket ? BUCKET_LABELS[activeBucket] || 'Files' : 'All Files')

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '25' })

      if (activeBucket) {
        params.set('bucket', activeBucket)
      }
      if (chapterId) {
        params.set('chapter_id', chapterId)
      }
      if (search) {
        params.set('search', search)
      }
      if (folderId) {
        params.set('folder_id', folderId)
      }

      const res = await fetch(`/api/files?${params}`)
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      setFiles(data.files)
      setTotalPages(data.pagination.totalPages)
      setTotalCount(data.pagination.total)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [activeBucket, page, search, chapterId, folderId])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  // Reset page when bucket or folder changes
  useEffect(() => {
    setPage(1)
  }, [bucketParam, folderId])

  const handleDownload = async (file) => {
    try {
      const res = await fetch(`/api/files/download/${file.id}`)
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 404) {
          fetchFiles()
          return
        }
        throw new Error(data.error)
      }

      window.open(data.url, '_blank')
    } catch (err) {
      alert(`Download failed: ${err.message}`)
    }
  }

  const handleDelete = async (file) => {
    if (!confirm(`Delete "${file.original_filename}"?`)) return

    setDeleting(file.id)
    try {
      const res = await fetch(`/api/files/${file.id}`, { method: 'DELETE' })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error)

      fetchFiles()
    } catch (err) {
      alert(`Delete failed: ${err.message}`)
    } finally {
      setDeleting(null)
    }
  }

  const handleMoveComplete = () => {
    fetchFiles()
  }

  const uploadHref = folderId
    ? `/workspace/resources/upload?folder=${folderId}`
    : '/workspace/resources/upload'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Breadcrumbs */}
      {folderId && (
        <FolderBreadcrumbs folderId={folderId} chapterId={chapterId} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{pageTitle}</h1>
          {!loading && (
            <p className="text-xs text-gray-500 mt-0.5">
              {totalCount} {totalCount === 1 ? 'file' : 'files'}
              {search && ` matching "${search}"`}
            </p>
          )}
        </div>
        <Link
          href={uploadHref}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-labor-red hover:bg-red-700 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload
        </Link>
      </div>

      {/* Folder tree for chapter users (show alongside files when browsing by chapter) */}
      {chapterId && !activeBucket && (
        <div className="mb-4 bg-white border border-stone-200 rounded p-3">
          <FolderTree
            chapterId={chapterId}
            selectedFolderId={folderId}
            onFolderSelect={(id) => {
              router.push(`/workspace/resources?folder=${id}`)
            }}
          />
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search files..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setPage(1) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-labor-red"></div>
        </div>
      ) : error ? (
        <div className="bg-white border border-stone-200 rounded p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={fetchFiles} className="mt-2 text-sm text-labor-red hover:underline">
            Try again
          </button>
        </div>
      ) : files.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded p-12 text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="text-sm text-gray-500 mb-1">No files found</p>
          {search ? (
            <button
              onClick={() => setSearch('')}
              className="text-sm text-labor-red hover:underline"
            >
              Clear search
            </button>
          ) : (
            <Link href={uploadHref} className="text-sm text-labor-red hover:underline">
              Upload your first file
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded divide-y divide-stone-100">
          {files.map(file => (
            <div
              key={file.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group cursor-pointer"
              onClick={() => setPreviewFile(file)}
            >
              {/* Icon / Preview */}
              {file.mime_type?.startsWith('image/') ? (
                <ImagePreview fileId={file.id} filename={file.original_filename} />
              ) : (
                <div className="w-10 h-10 bg-gray-50 rounded flex items-center justify-center flex-shrink-0">
                  <FileTypeIcon mimeType={file.mime_type} />
                </div>
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate">{file.original_filename}</div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-500">{formatFileSize(file.file_size_bytes)}</span>
                  <span className="text-xs text-gray-300">&middot;</span>
                  <span className="text-xs text-gray-500">{formatDate(file.uploaded_at)}</span>
                  {file.uploader_name && file.uploader_name !== 'Unknown' && (
                    <>
                      <span className="text-xs text-gray-300">&middot;</span>
                      <span className="text-xs text-gray-400">{file.uploader_name}</span>
                    </>
                  )}
                  {!activeBucket && file.bucket_prefix && (
                    <span className="text-xs text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                      {BUCKET_LABELS[file.bucket_prefix] || file.bucket_prefix}
                    </span>
                  )}
                  {file.chapters && (
                    <span className="text-xs text-gray-400">{file.chapters.name}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                {/* Move to folder */}
                {chapterId && (
                  <button
                    onClick={() => setMoveFile(file)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                    title="Move to folder"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => handleDownload(file)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  title="Download"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(file)}
                  disabled={deleting === file.id}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  {deleting === file.id ? (
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-stone-200 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 border border-stone-200 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={handleDownload}
          onDelete={handleDelete}
        />
      )}

      {/* Move to Folder Modal */}
      {moveFile && chapterId && (
        <MoveToFolderModal
          fileId={moveFile.id}
          currentFolderId={moveFile.folder_id || null}
          chapterId={chapterId}
          onMove={handleMoveComplete}
          onClose={() => setMoveFile(null)}
        />
      )}
    </div>
  )
}
