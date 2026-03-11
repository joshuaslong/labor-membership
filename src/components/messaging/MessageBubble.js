'use client'

import { useState } from 'react'

function formatTimestamp(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  if (isToday) return time

  const monthDay = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
  return `${monthDay}, ${time}`
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500'
]

function getAvatarColor(name) {
  let hash = 0
  for (let i = 0; i < (name?.length || 0); i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '👀', '🙏']

function ReactionBar({ reactions, onReact }) {
  const [showPicker, setShowPicker] = useState(false)

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {reactions?.map(r => (
        <button
          key={r.emoji}
          onClick={() => onReact(r.emoji)}
          title={r.users.map(u => u.name).join(', ')}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
            r.reacted
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-stone-50 border-stone-200 text-gray-600 hover:bg-stone-100'
          }`}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}
      <div className="relative">
        <button
          onClick={() => setShowPicker(p => !p)}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-gray-400 hover:text-gray-600 hover:bg-stone-100 transition-colors text-xs"
          title="Add reaction"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        {showPicker && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
            <div className="absolute bottom-full left-0 mb-1 z-20 bg-white border border-stone-200 rounded-lg shadow-lg p-1.5 flex gap-1">
              {QUICK_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => { onReact(emoji); setShowPicker(false) }}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-stone-100 text-base transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AttachmentList({ attachments, channelId }) {
  const handleDownload = async (attachment) => {
    try {
      const res = await fetch(`/api/workspace/messaging/channels/${channelId}/attachments?attachmentId=${attachment.id}`)
      if (!res.ok) return
      const { downloadUrl } = await res.json()
      window.open(downloadUrl, '_blank')
    } catch {
      // Silent fail
    }
  }

  const isImage = (mimeType) => mimeType?.startsWith('image/')

  return (
    <div className="flex flex-wrap gap-2 mt-1.5">
      {attachments.map(a => (
        <button
          key={a.id}
          onClick={() => handleDownload(a)}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded border border-stone-200 bg-stone-50 hover:bg-stone-100 transition-colors max-w-xs"
          title={`Download ${a.filename}`}
        >
          {isImage(a.mimeType) ? (
            <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          )}
          <div className="min-w-0 text-left">
            <div className="text-xs font-medium text-gray-700 truncate">{a.filename}</div>
            {a.fileSize && (
              <div className="text-[10px] text-gray-400">{formatFileSize(a.fileSize)}</div>
            )}
          </div>
          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      ))}
    </div>
  )
}

export default function MessageBubble({ message, isOwn, onEdit, onDelete, onReact, channelId }) {
  const sender = message.sender || {}
  const senderName = [sender.first_name, sender.last_name].filter(Boolean).join(' ') || 'Unknown'
  const initial = (sender.first_name?.[0] || senderName[0] || '?').toUpperCase()
  const hasReactions = message.reactions?.length > 0
  const hasAttachments = message.attachments?.length > 0

  if (message.is_deleted) {
    return (
      <div className="flex items-start gap-3 px-4 py-1.5">
        <div className="w-8 h-8 shrink-0" />
        <div className="text-sm text-gray-400 italic">[message deleted]</div>
      </div>
    )
  }

  return (
    <div
      className="relative flex items-start gap-3 px-4 py-1.5 hover:bg-stone-50 group"
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 ${getAvatarColor(senderName)}`}
      >
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-gray-900">{senderName}</span>
          <span className="text-xs text-gray-400">
            {formatTimestamp(message.created_at)}
            {message.is_edited && <span className="ml-1 text-gray-400">(edited)</span>}
          </span>
        </div>
        {message.content && (
          <p className="text-base md:text-sm text-gray-800 whitespace-pre-wrap break-words">{message.content}</p>
        )}
        {hasAttachments && <AttachmentList attachments={message.attachments} channelId={channelId} />}
        {(hasReactions || onReact) && (
          <ReactionBar reactions={message.reactions || []} onReact={(emoji) => onReact?.(message.id, emoji)} />
        )}
      </div>
      <div className="absolute right-3 -top-2 hidden group-hover:flex items-center gap-0.5 bg-white border border-stone-200 rounded shadow-sm px-0.5 py-0.5">
        <button
          onClick={() => {
            const picker = document.getElementById(`reaction-picker-${message.id}`)
            if (picker) picker.click()
          }}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
          title="React"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        {isOwn && (
          <>
            <button
              onClick={() => onEdit?.(message)}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Edit"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete?.(message)}
              className="p-1 text-gray-400 hover:text-red-500 rounded"
              title="Delete"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}
