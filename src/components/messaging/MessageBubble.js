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

export default function MessageBubble({ message, isOwn, onEdit, onDelete }) {
  const [hovering, setHovering] = useState(false)

  const sender = message.sender || {}
  const senderName = [sender.first_name, sender.last_name].filter(Boolean).join(' ') || 'Unknown'
  const initial = (sender.first_name?.[0] || senderName[0] || '?').toUpperCase()

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
      className="flex items-start gap-3 px-4 py-1.5 hover:bg-stone-50 group"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
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
          {isOwn && hovering && (
            <div className="ml-auto flex items-center gap-1">
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
            </div>
          )}
        </div>
        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  )
}
