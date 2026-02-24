'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const BUCKET_LABELS = {
  'public': 'Public Files',
  'chapters': 'Chapter Documents',
  'media/social': 'Social Media',
  'media/podcast': 'Podcast',
  'internal-docs': 'Internal Documents',
}

function isImageFile(file) {
  return file.type && file.type.startsWith('image/')
}

function SelectedImagePreview({ file }) {
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    if (!isImageFile(file)) return
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  if (!previewUrl) return null

  return (
    <div className="w-12 h-12 relative rounded overflow-hidden flex-shrink-0 bg-gray-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt={file.name}
        className="w-full h-full object-cover"
      />
    </div>
  )
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function FileTypeIcon({ mimeType, className = 'w-5 h-5' }) {
  if (mimeType?.startsWith('video/')) {
    return (
      <svg className={`${className} text-purple-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    )
  }
  if (mimeType?.startsWith('audio/')) {
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

function FolderSelector({ chapterId, selectedFolderId, onSelect, disabled }) {
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!chapterId) return
    setLoading(true)

    async function loadFolders() {
      try {
        // Load all folders recursively (flatten for dropdown)
        const allFolders = []

        async function loadLevel(parentId, depth) {
          const params = new URLSearchParams({ chapter_id: chapterId })
          if (parentId) params.set('parent_id', parentId)

          const res = await fetch(`/api/folders?${params}`)
          const data = await res.json()
          if (!res.ok) return

          for (const folder of data.folders) {
            allFolders.push({ ...folder, depth })
            if (folder.subfolder_count > 0) {
              await loadLevel(folder.id, depth + 1)
            }
          }
        }

        await loadLevel(null, 0)
        setFolders(allFolders)
      } catch {
        setFolders([])
      } finally {
        setLoading(false)
      }
    }

    loadFolders()
  }, [chapterId])

  if (!chapterId) return null

  return (
    <div className="bg-white border border-stone-200 rounded p-4 mb-4">
      <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">
        Folder
      </label>
      <select
        value={selectedFolderId || ''}
        onChange={(e) => onSelect(e.target.value || null)}
        disabled={disabled || loading}
        className="w-full px-3 py-1.5 text-sm border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red bg-white disabled:opacity-50"
      >
        <option value="">No folder (root)</option>
        {folders.map(folder => (
          <option key={folder.id} value={folder.id}>
            {'  '.repeat(folder.depth)}{folder.name}
          </option>
        ))}
      </select>
      {loading && (
        <p className="text-xs text-gray-400 mt-1">Loading folders...</p>
      )}
    </div>
  )
}

export default function ResourceUploader({ allowedBuckets = ['chapters'], chapterId = null, defaultFolderId = null }) {
  const router = useRouter()
  const [selectedBucket, setSelectedBucket] = useState(allowedBuckets[0])
  const [selectedFolderId, setSelectedFolderId] = useState(defaultFolderId)
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({})
  const [errors, setErrors] = useState({})
  const [isDragging, setIsDragging] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)
  const fileInputRef = useRef(null)
  const maxFiles = 10

  const handleFileSelect = (selectedFiles) => {
    const newFiles = Array.from(selectedFiles || [])
    if (newFiles.length + files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed`)
      return
    }

    setFiles(prev => [...prev, ...newFiles.map(f => ({
      file: f,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description: '',
    }))])
  }

  const handleInputChange = (e) => {
    handleFileSelect(e.target.files)
    e.target.value = ''
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }, [files.length])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id))
    setProgress(prev => { const n = { ...prev }; delete n[id]; return n })
    setErrors(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const updateDescription = (id, description) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, description } : f))
  }

  const uploadFile = async (fileItem) => {
    const { file, id, description } = fileItem

    try {
      setProgress(prev => ({ ...prev, [id]: 10 }))
      setErrors(prev => { const n = { ...prev }; delete n[id]; return n })

      const presignRes = await fetch('/api/files/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          fileSize: file.size,
          bucketPrefix: selectedBucket,
          chapterId: chapterId,
          description: description || null,
          folder_id: selectedFolderId || null,
        }),
      })

      const presignData = await presignRes.json()
      if (!presignRes.ok) {
        throw new Error(presignData.error || 'Unable to prepare upload.')
      }

      setProgress(prev => ({ ...prev, [id]: 40 }))

      let uploadRes
      try {
        uploadRes = await fetch(presignData.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        })
      } catch {
        throw new Error('Connection failed. Check your internet and try again.')
      }

      if (!uploadRes.ok) {
        throw new Error('Upload failed. Please try again.')
      }

      setProgress(prev => ({ ...prev, [id]: 100 }))
      setCompletedCount(prev => prev + 1)

      return { success: true, fileId: presignData.fileId }
    } catch (err) {
      setErrors(prev => ({ ...prev, [id]: err.message }))
      setProgress(prev => ({ ...prev, [id]: -1 }))
      return { success: false, error: err.message }
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)
    setCompletedCount(0)

    const results = await Promise.all(files.map(uploadFile))

    setUploading(false)

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    if (successCount > 0 && failCount === 0) {
      const redirectUrl = selectedFolderId
        ? `/workspace/resources?folder=${selectedFolderId}`
        : '/workspace/resources'
      router.push(redirectUrl)
    } else if (successCount > 0) {
      // Remove successful uploads, keep failed ones
      const successIds = new Set(
        files.filter((_, i) => results[i].success).map(f => f.id)
      )
      setFiles(prev => prev.filter(f => !successIds.has(f.id)))
      setProgress(prev => {
        const n = { ...prev }
        successIds.forEach(id => delete n[id])
        return n
      })
    }
  }

  const totalSize = files.reduce((acc, f) => acc + f.file.size, 0)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Upload Files</h1>
          <p className="text-xs text-gray-500 mt-0.5">Add files to your workspace resources</p>
        </div>
        <Link
          href="/workspace/resources"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          Back to files
        </Link>
      </div>

      {/* Bucket Selection */}
      {allowedBuckets.length > 1 && (
        <div className="bg-white border border-stone-200 rounded p-4 mb-4">
          <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">
            Destination
          </label>
          <div className="flex flex-wrap gap-2">
            {allowedBuckets.map(bucket => (
              <button
                key={bucket}
                onClick={() => setSelectedBucket(bucket)}
                disabled={uploading}
                className={`px-3 py-1.5 text-sm rounded transition-colors ${
                  selectedBucket === bucket
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-50 text-gray-700 border border-stone-200 hover:bg-gray-100'
                } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {BUCKET_LABELS[bucket] || bucket}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Folder Selection */}
      <FolderSelector
        chapterId={chapterId}
        selectedFolderId={selectedFolderId}
        onSelect={setSelectedFolderId}
        disabled={uploading}
      />

      {/* Drop Zone */}
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded p-8 text-center transition-colors ${
          isDragging
            ? 'border-labor-red bg-red-50'
            : 'border-stone-300 hover:border-stone-400 bg-white'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={uploading}
        />
        <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p className="text-sm text-gray-600 font-medium">
          {isDragging ? 'Drop files here' : 'Click to select or drag and drop'}
        </p>
        <p className="text-xs text-gray-400 mt-1">Up to {maxFiles} files</p>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-0 bg-white border border-stone-200 rounded divide-y divide-stone-100">
          {files.map(({ file, id, description }) => (
            <div key={id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                {/* Preview or icon */}
                {isImageFile(file) ? (
                  <SelectedImagePreview file={file} />
                ) : (
                  <div className="w-12 h-12 bg-gray-50 rounded flex items-center justify-center flex-shrink-0">
                    <FileTypeIcon mimeType={file.type} />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{file.name}</span>
                    {!uploading && (
                      <button
                        onClick={() => removeFile(id)}
                        className="p-1 text-gray-400 hover:text-red-500 flex-shrink-0 transition-colors"
                        title="Remove"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{formatSize(file.size)}</span>

                  {/* Description */}
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => updateDescription(id, e.target.value)}
                    placeholder="Add a description..."
                    className="mt-1.5 w-full px-2.5 py-1.5 text-xs border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red bg-gray-50"
                    disabled={uploading}
                  />

                  {/* Progress */}
                  {progress[id] !== undefined && progress[id] >= 0 && (
                    <div className="mt-2">
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            progress[id] === 100 ? 'bg-emerald-500' : 'bg-labor-red'
                          }`}
                          style={{ width: `${progress[id]}%` }}
                        />
                      </div>
                      {progress[id] === 100 && (
                        <span className="text-xs text-emerald-600 mt-1 inline-block">Uploaded</span>
                      )}
                    </div>
                  )}

                  {/* Error */}
                  {errors[id] && (
                    <p className="mt-1.5 text-xs text-red-600">{errors[id]}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Footer */}
      {files.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {files.length} {files.length === 1 ? 'file' : 'files'} · {formatSize(totalSize)}
            {uploading && completedCount > 0 && ` · ${completedCount}/${files.length} uploaded`}
          </span>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-labor-red hover:bg-red-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Upload {files.length} {files.length === 1 ? 'File' : 'Files'}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
