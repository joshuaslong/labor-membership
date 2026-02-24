'use client'

import { useState } from 'react'
import Link from 'next/link'
import AssetDetailModal from './AssetDetailModal'

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function FileTypeIcon({ mimeType, className = 'w-8 h-8' }) {
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

function AssetThumbnail({ file, onClick }) {
  const isImage = file.mime_type?.startsWith('image/')

  return (
    <button
      type="button"
      onClick={() => onClick(file)}
      className="group text-left w-full"
    >
      <div className="aspect-square bg-white border border-stone-200 rounded-lg overflow-hidden flex items-center justify-center group-hover:border-stone-300 group-hover:shadow-sm transition-all">
        {isImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/files/preview/${file.id}`}
            alt={file.original_filename}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
          />
        ) : (
          <FileTypeIcon mimeType={file.mime_type} className="w-10 h-10" />
        )}
      </div>
      <div className="mt-1.5 px-0.5">
        <p className="text-xs text-gray-700 truncate group-hover:text-gray-900 transition-colors">
          {file.original_filename}
        </p>
        {file.file_size_bytes && (
          <p className="text-xs text-gray-400">{formatFileSize(file.file_size_bytes)}</p>
        )}
      </div>
    </button>
  )
}

export default function CollectionPage({ collection, backHref, backLabel }) {
  const [selectedFile, setSelectedFile] = useState(null)

  const sections = collection?.sections || []

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Back link */}
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {backLabel || 'Back'}
        </Link>
      )}

      {/* Collection header */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium tracking-tight text-gray-900">{collection.name}</h1>
        {collection.description && (
          <p className="text-sm text-gray-500 mt-1.5 max-w-3xl">{collection.description}</p>
        )}
      </div>

      {/* Sections */}
      {sections.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-gray-500">This collection has no assets yet.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {sections.map((section) => (
            <div key={section.id}>
              {/* Section header */}
              <div className="border-b border-stone-200 pb-2 mb-4">
                <h2 className="text-xs uppercase tracking-wide text-gray-500 font-medium">
                  {section.name}
                </h2>
              </div>

              {/* Thumbnail grid */}
              {section.files && section.files.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {section.files.map((file) => (
                    <AssetThumbnail
                      key={file.id}
                      file={file}
                      onClick={setSelectedFile}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No assets in this section.</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Asset Detail Modal */}
      {selectedFile && (
        <AssetDetailModal
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  )
}
