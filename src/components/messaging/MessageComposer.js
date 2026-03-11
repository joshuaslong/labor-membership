'use client'

import { useState, useRef, useCallback } from 'react'

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function MessageComposer({ onSend, disabled, channelId }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [files, setFiles] = useState([]) // { file, uploading, uploaded, error, fileId, r2Key }
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

  const uploadFile = async (fileEntry) => {
    try {
      // Get presigned upload URL
      const res = await fetch(`/api/workspace/messaging/channels/${channelId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: fileEntry.file.name,
          contentType: fileEntry.file.type || 'application/octet-stream',
          fileSize: fileEntry.file.size,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Upload failed')
      }

      const { uploadUrl, fileId, r2Key } = await res.json()

      // Upload to R2
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: fileEntry.file,
        headers: { 'Content-Type': fileEntry.file.type || 'application/octet-stream' },
      })

      if (!uploadRes.ok) throw new Error('Failed to upload file')

      return { fileId, r2Key }
    } catch (err) {
      throw err
    }
  }

  const handleFiles = async (selectedFiles) => {
    const newFiles = Array.from(selectedFiles).map(file => ({
      file,
      uploading: true,
      uploaded: false,
      error: null,
      fileId: null,
      r2Key: null,
      id: Math.random().toString(36).slice(2),
    }))

    setFiles(prev => [...prev, ...newFiles])

    // Upload each file
    for (const entry of newFiles) {
      try {
        const { fileId, r2Key } = await uploadFile(entry)
        setFiles(prev =>
          prev.map(f =>
            f.id === entry.id
              ? { ...f, uploading: false, uploaded: true, fileId, r2Key }
              : f
          )
        )
      } catch (err) {
        setFiles(prev =>
          prev.map(f =>
            f.id === entry.id
              ? { ...f, uploading: false, error: err.message }
              : f
          )
        )
      }
    }
  }

  const removeFile = (id) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const handleSubmit = useCallback(async () => {
    const uploadedFiles = files.filter(f => f.uploaded)
    if ((!text.trim() && uploadedFiles.length === 0) || disabled || sending) return
    if (files.some(f => f.uploading)) return // Wait for uploads

    setSending(true)
    try {
      const attachments = uploadedFiles.map(f => ({
        fileId: f.fileId,
        r2Key: f.r2Key,
        filename: f.file.name,
        fileSize: f.file.size,
        contentType: f.file.type,
      }))

      await onSend(text, attachments.length > 0 ? attachments : undefined)
      setText('')
      setFiles([])
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch {
      // Error handled by parent
    } finally {
      setSending(false)
    }
  }, [text, files, disabled, sending, onSend])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = (e) => {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const hasUploading = files.some(f => f.uploading)
  const hasUploadedFiles = files.some(f => f.uploaded)

  return (
    <div className="border-t border-stone-200 bg-white px-4 py-3 shrink-0">
      <div className="max-w-4xl mx-auto">
        {/* File previews */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {files.map(f => (
              <div
                key={f.id}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs ${
                  f.error
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : f.uploading
                    ? 'border-stone-200 bg-stone-50 text-gray-500'
                    : 'border-green-200 bg-green-50 text-green-700'
                }`}
              >
                {f.uploading && (
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                )}
                <span className="truncate max-w-[120px]">{f.file.name}</span>
                {f.error
                  ? <span className="text-[10px]">{f.error}</span>
                  : <span className="text-[10px] opacity-70">{formatFileSize(f.file.size)}</span>
                }
                <button
                  onClick={() => removeFile(f.id)}
                  className="ml-0.5 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* File upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="shrink-0 rounded p-2 text-gray-400 hover:text-gray-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Attach a file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                handleFiles(e.target.files)
                e.target.value = '' // Reset so same file can be selected again
              }
            }}
          />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Select a channel to start messaging' : 'Type a message...'}
            disabled={disabled || sending}
            rows={1}
            className="flex-1 resize-none rounded border border-stone-200 px-3 py-2 text-base md:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-stone-400 disabled:bg-stone-50 disabled:text-gray-400"
          />
          <button
            onClick={handleSubmit}
            disabled={disabled || sending || hasUploading || (!text.trim() && !hasUploadedFiles)}
            className="shrink-0 rounded bg-labor-red px-3 py-2 text-sm font-medium text-white hover:bg-labor-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
