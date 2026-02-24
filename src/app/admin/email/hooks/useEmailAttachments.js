import { useState, useCallback } from 'react'
import { formatFileSize } from '@/lib/r2'

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv', 'text/plain',
]

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

export function useEmailAttachments() {
  const [attachments, setAttachments] = useState([])

  const addFiles = useCallback(async (fileList) => {
    const files = Array.from(fileList)

    for (const file of files) {
      // Validate type
      if (!ALLOWED_TYPES.includes(file.type) && file.type !== 'application/octet-stream') {
        setAttachments(prev => [...prev, {
          id: crypto.randomUUID(),
          filename: file.name,
          size: file.size,
          mimeType: file.type,
          uploading: false,
          error: 'File type not supported',
          fileId: null,
          r2Key: null,
        }])
        continue
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        setAttachments(prev => [...prev, {
          id: crypto.randomUUID(),
          filename: file.name,
          size: file.size,
          mimeType: file.type,
          uploading: false,
          error: `File too large (max ${formatFileSize(MAX_FILE_SIZE)})`,
          fileId: null,
          r2Key: null,
        }])
        continue
      }

      // Add as uploading
      const tempId = crypto.randomUUID()
      setAttachments(prev => [...prev, {
        id: tempId,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        uploading: true,
        error: null,
        fileId: null,
        r2Key: null,
      }])

      try {
        // Step 1: Get presigned upload URL
        const res = await fetch('/api/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            fileSize: file.size,
            bucketPrefix: 'public',
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Upload failed')
        }

        const { uploadUrl, fileId, r2Key } = await res.json()

        // Step 2: Upload file to R2 via presigned URL
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        })

        if (!uploadRes.ok) {
          throw new Error('Failed to upload file to storage')
        }

        // Update attachment with success
        setAttachments(prev => prev.map(a =>
          a.id === tempId
            ? { ...a, uploading: false, fileId, r2Key }
            : a
        ))
      } catch (err) {
        setAttachments(prev => prev.map(a =>
          a.id === tempId
            ? { ...a, uploading: false, error: err.message }
            : a
        ))
      }
    }
  }, [])

  const removeFile = useCallback((id) => {
    setAttachments(prev => prev.filter(a => a.id !== id))
  }, [])

  const clearAll = useCallback(() => {
    setAttachments([])
  }, [])

  // Restore attachments from draft (metadata only, no re-upload)
  const restoreAttachments = useCallback((saved) => {
    if (Array.isArray(saved) && saved.length > 0) {
      setAttachments(saved)
    }
  }, [])

  // Get successfully uploaded attachments
  const uploadedAttachments = attachments.filter(a => a.fileId && !a.uploading && !a.error)
  const isUploading = attachments.some(a => a.uploading)

  return {
    attachments,
    uploadedAttachments,
    isUploading,
    addFiles,
    removeFile,
    clearAll,
    restoreAttachments,
  }
}
