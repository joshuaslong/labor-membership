'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

function isImageFile(file) {
  return file.type && file.type.startsWith('image/')
}

// Preview component for selected image files (before upload)
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
    <div className="w-16 h-16 relative rounded overflow-hidden flex-shrink-0 bg-gray-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt={file.name}
        className="w-full h-full object-cover"
      />
    </div>
  )
}

const BUCKET_LABELS = {
  'public': 'Public Files (logos, brand kit)',
  'chapters': 'Chapter Documents',
  'media/social': 'Social Media Videos',
  'media/podcast': 'Podcast Files',
  'internal-docs': 'Internal Documents',
}

export default function FileUploader({
  allowedBuckets = ['chapters'],
  chapterId = null,
  onUploadComplete = null,
  maxFiles = 5,
}) {
  const [selectedBucket, setSelectedBucket] = useState(allowedBuckets[0])
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({})
  const [errors, setErrors] = useState({})
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

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
    e.target.value = '' // Reset input
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }, [files.length, maxFiles])

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
    setProgress(prev => { const n = {...prev}; delete n[id]; return n })
    setErrors(prev => { const n = {...prev}; delete n[id]; return n })
  }

  const updateDescription = (id, description) => {
    setFiles(prev => prev.map(f => f.id === id ? {...f, description} : f))
  }

  const uploadFile = async (fileItem) => {
    const { file, id, description } = fileItem

    try {
      setProgress(prev => ({...prev, [id]: 10}))
      setErrors(prev => { const n = {...prev}; delete n[id]; return n })

      // Step 1: Get presigned URL
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
        }),
      })

      const presignData = await presignRes.json()
      if (!presignRes.ok) {
        throw new Error(presignData.error || 'Unable to prepare upload. Please try again.')
      }

      setProgress(prev => ({...prev, [id]: 30}))

      // Step 2: Upload to R2 using presigned URL
      let uploadRes
      try {
        uploadRes = await fetch(presignData.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        })
      } catch (networkErr) {
        throw new Error('Unable to connect to storage. Please check your internet connection and try again.')
      }

      if (!uploadRes.ok) {
        throw new Error('Upload failed. Please try again or contact support if the problem persists.')
      }

      setProgress(prev => ({...prev, [id]: 100}))

      return { success: true, fileId: presignData.fileId }

    } catch (err) {
      setErrors(prev => ({...prev, [id]: err.message}))
      setProgress(prev => ({...prev, [id]: -1}))
      return { success: false, error: err.message }
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) return

    setUploading(true)

    const results = await Promise.all(files.map(uploadFile))

    setUploading(false)

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    if (successCount > 0) {
      // Clear successful uploads
      const successIds = new Set(
        files.filter((_, i) => results[i].success).map(f => f.id)
      )
      setFiles(prev => prev.filter(f => !successIds.has(f.id)))

      // Clear progress for successful uploads
      setProgress(prev => {
        const n = {...prev}
        successIds.forEach(id => delete n[id])
        return n
      })

      if (onUploadComplete) {
        onUploadComplete(results.filter(r => r.success).map(r => r.fileId))
      }
    }

    if (failCount > 0) {
      alert(`${failCount} file(s) failed to upload. Check the error messages below.`)
    } else if (successCount > 0) {
      alert(`${successCount} file(s) uploaded successfully!`)
    }
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="space-y-4">
      {/* Bucket Selection */}
      {allowedBuckets.length > 1 && (
        <div>
          <label className="input-label">
            Upload Location
          </label>
          <select
            value={selectedBucket}
            onChange={(e) => setSelectedBucket(e.target.value)}
            className="input-field"
            disabled={uploading}
          >
            {allowedBuckets.map(bucket => (
              <option key={bucket} value={bucket}>
                {BUCKET_LABELS[bucket] || bucket}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onClick={() => !uploading && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragging
            ? 'border-labor-red bg-red-50'
            : 'border-gray-300 hover:border-labor-red hover:bg-red-50'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={uploading}
        />
        <div className="text-4xl mb-2">\ud83d\udcc1</div>
        <div className="text-gray-600 font-medium">
          {isDragging ? 'Drop files here' : 'Click to select files or drag and drop'}
        </div>
        <div className="text-sm text-gray-400 mt-1">
          Maximum {maxFiles} files
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          {files.map(({ file, id, description }) => (
            <div key={id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-start justify-between gap-4">
                {isImageFile(file) && (
                  <SelectedImagePreview file={file} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{file.name}</div>
                  <div className="text-sm text-gray-500">
                    {formatSize(file.size)} &middot; {file.type || 'Unknown type'}
                  </div>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => updateDescription(id, e.target.value)}
                    placeholder="Description (optional)"
                    className="mt-2 w-full px-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
                    disabled={uploading}
                  />
                </div>
                <button
                  onClick={() => removeFile(id)}
                  className="text-gray-400 hover:text-red-600 p-1"
                  disabled={uploading}
                  title="Remove"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Progress */}
              {progress[id] !== undefined && progress[id] >= 0 && (
                <div className="mt-3">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        progress[id] === 100 ? 'bg-green-500' : 'bg-labor-red'
                      }`}
                      style={{ width: `${progress[id]}%` }}
                    />
                  </div>
                  {progress[id] === 100 && (
                    <div className="text-sm text-green-600 mt-1">Uploaded successfully</div>
                  )}
                </div>
              )}

              {/* Error */}
              {errors[id] && (
                <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                  Error: {errors[id]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Uploading...
            </span>
          ) : (
            `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`
          )}
        </button>
      )}
    </div>
  )
}
