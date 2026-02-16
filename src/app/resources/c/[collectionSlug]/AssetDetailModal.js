'use client'

import { useEffect, useRef, useState } from 'react'

function formatFileSize(bytes) {
  if (!bytes) return 'Unknown size'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function getFileExtension(filename) {
  if (!filename) return ''
  const parts = filename.split('.')
  return parts.length > 1 ? parts.pop().toUpperCase() : ''
}

function FileTypeIcon({ mimeType, className = 'w-16 h-16' }) {
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

function getTypeBadgeColor(mimeType) {
  if (!mimeType) return 'bg-gray-100 text-gray-600'
  if (mimeType.startsWith('image/')) return 'bg-emerald-50 text-emerald-700'
  if (mimeType.startsWith('video/')) return 'bg-purple-50 text-purple-700'
  if (mimeType.startsWith('audio/')) return 'bg-blue-50 text-blue-700'
  if (mimeType === 'application/pdf') return 'bg-red-50 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

export default function AssetDetailModal({ file, onClose }) {
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

  const ext = getFileExtension(file.original_filename)
  const badgeColor = getTypeBadgeColor(file.mime_type)

  const handleDownload = () => {
    window.open(`/api/files/download/${file.id}`, '_blank')
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Preview area */}
        <div className="flex-shrink-0">
          {isImage ? (
            <div className="flex items-center justify-center bg-stone-50 rounded-t-lg min-h-[200px] max-h-[50vh] relative overflow-hidden">
              {imgLoading && !imgError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-labor-red rounded-full animate-spin" />
                </div>
              )}
              {imgError ? (
                <div className="py-12 text-center">
                  <FileTypeIcon mimeType="image/" className="w-12 h-12 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Preview unavailable</p>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={`/api/files/preview/${file.id}`}
                  alt={file.original_filename}
                  className="max-w-full max-h-[50vh] object-contain"
                  onLoad={() => setImgLoading(false)}
                  onError={() => { setImgError(true); setImgLoading(false) }}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-8 bg-stone-50 rounded-t-lg">
              <div className="w-20 h-20 bg-white rounded-xl border border-stone-200 flex items-center justify-center mb-3 shadow-sm">
                <FileTypeIcon mimeType={file.mime_type} className="w-10 h-10" />
              </div>
            </div>
          )}
        </div>

        {/* File details */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{file.original_filename}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {ext && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${badgeColor}`}>
                  {ext}
                </span>
              )}
              {file.file_size_bytes && (
                <span className="text-xs text-gray-500">{formatFileSize(file.file_size_bytes)}</span>
              )}
            </div>
          </div>

          {file.description && (
            <p className="text-sm text-gray-600">{file.description}</p>
          )}
        </div>

        {/* Download button */}
        <div className="px-5 pb-5">
          <button
            onClick={handleDownload}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-labor-red hover:bg-labor-red/90 rounded-lg transition-colors"
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
