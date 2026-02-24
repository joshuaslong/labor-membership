import { useRef } from 'react'

function formatFileSize(bytes) {
  if (!bytes) return 'Unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

const FILE_TYPE_ICONS = {
  'application/pdf': 'PDF',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-powerpoint': 'PPT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'text/csv': 'CSV',
  'text/plain': 'TXT',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/gif': 'GIF',
  'image/webp': 'WEBP',
}

function getFileTypeLabel(mimeType, filename) {
  if (FILE_TYPE_ICONS[mimeType]) return FILE_TYPE_ICONS[mimeType]
  const ext = filename?.split('.').pop()?.toUpperCase()
  return ext || 'FILE'
}

export default function EmailAttachments({
  attachments = [],
  uploadedAttachments = [],
  isUploading = false,
  onAddFiles,
  onRemoveFile,
  onInsertLinks,
}) {
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    if (e.target.files?.length && typeof onAddFiles === 'function') {
      onAddFiles(e.target.files)
    }
    // Reset so the same file can be selected again
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.files?.length && typeof onAddFiles === 'function') {
      onAddFiles(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Attachments
      </h3>

      {/* Hidden file input - kept outside clickable div to prevent event bubbling */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Drop zone / file picker */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-gray-300 transition-colors cursor-pointer"
      >
        <svg className="w-6 h-6 mx-auto text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
        </svg>
        <p className="text-sm text-gray-500">
          Drop files here or <span className="text-labor-red font-medium">browse</span>
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          PDF, Word, Excel, PowerPoint, images, CSV, TXT (max 25MB each)
        </p>
      </div>

      {/* Attachment list */}
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                attachment.error
                  ? 'bg-red-50 border border-red-100'
                  : 'bg-gray-50 border border-gray-100'
              }`}
            >
              {/* File type badge */}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                attachment.error
                  ? 'bg-red-100 text-red-600'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {getFileTypeLabel(attachment.mimeType, attachment.filename)}
              </span>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-gray-900 truncate text-xs">{attachment.filename}</p>
                {attachment.error ? (
                  <p className="text-red-500 text-xs">{attachment.error}</p>
                ) : attachment.uploading ? (
                  <p className="text-gray-400 text-xs">Uploading...</p>
                ) : (
                  <p className="text-gray-400 text-xs">{formatFileSize(attachment.size)}</p>
                )}
              </div>

              {/* Upload spinner */}
              {attachment.uploading && (
                <svg className="animate-spin h-4 w-4 text-gray-400 shrink-0" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}

              {/* Remove button */}
              {!attachment.uploading && (
                <button
                  type="button"
                  onClick={() => typeof onRemoveFile === 'function' && onRemoveFile(attachment.id)}
                  className="text-gray-400 hover:text-red-500 shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Insert links button */}
      {uploadedAttachments.length > 0 && (
        <button
          type="button"
          onClick={() => typeof onInsertLinks === 'function' && onInsertLinks()}
          disabled={isUploading}
          className="w-full text-sm py-1.5 px-3 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Insert download links into email ({uploadedAttachments.length} file{uploadedAttachments.length !== 1 ? 's' : ''})
        </button>
      )}
    </div>
  )
}
