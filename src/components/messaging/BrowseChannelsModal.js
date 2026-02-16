'use client'

import { useState } from 'react'

export default function BrowseChannelsModal({ isOpen, onClose, channels, onJoin }) {
  const [joiningId, setJoiningId] = useState(null)

  if (!isOpen) return null

  const handleJoin = async (channelId) => {
    setJoiningId(channelId)
    try {
      await onJoin?.(channelId)
    } finally {
      setJoiningId(null)
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded border border-stone-200 shadow-lg w-full max-w-lg mx-4 max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between shrink-0">
          <h3 className="text-sm font-semibold text-gray-900">Browse Channels</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto">
          {(!channels || channels.length === 0) ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No channels available in this chapter
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {channels.map(channel => (
                <li key={channel.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400 text-xs">#</span>
                      <span className="text-sm font-medium text-gray-900 truncate">{channel.name}</span>
                    </div>
                    {channel.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{channel.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      {channel.member_count ?? 0} {(channel.member_count ?? 0) === 1 ? 'member' : 'members'}
                    </p>
                  </div>
                  <div className="shrink-0">
                    {channel.is_member ? (
                      <span className="text-xs text-gray-400 bg-stone-100 px-2 py-1 rounded">Joined</span>
                    ) : (
                      <button
                        onClick={() => handleJoin(channel.id)}
                        disabled={joiningId === channel.id}
                        className="text-xs font-medium text-labor-red hover:text-labor-red-600 border border-labor-red px-2 py-1 rounded hover:bg-red-50 disabled:opacity-40 transition-colors"
                      >
                        {joiningId === channel.id ? 'Joining...' : 'Join'}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
