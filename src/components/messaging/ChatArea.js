'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useChannel } from '@/hooks/useChannel'
import ChannelHeader from './ChannelHeader'
import MessageBubble from './MessageBubble'
import MessageComposer from './MessageComposer'

export default function ChatArea({ channelId, channel, currentUser, onBack }) {
  const { messages, loading, hasMore, sendMessage, editMessage, deleteMessage, loadMore } = useChannel(channelId, currentUser)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const prevMessageCountRef = useRef(0)
  const isInitialLoadRef = useRef(true)

  // Mark channel as read when opened
  useEffect(() => {
    if (!channelId) return
    fetch(`/api/workspace/messaging/channels/${channelId}/read`, { method: 'POST' })
      .catch(() => {})
  }, [channelId])

  // Auto-scroll to bottom on new messages (not when loading older)
  useEffect(() => {
    const prevCount = prevMessageCountRef.current
    const newCount = messages.length

    if (newCount > prevCount) {
      // New messages added at the end or initial load
      if (isInitialLoadRef.current || newCount - prevCount <= 2) {
        // Initial load or a few new messages: scroll to bottom
        messagesEndRef.current?.scrollIntoView({ behavior: isInitialLoadRef.current ? 'instant' : 'smooth' })
        isInitialLoadRef.current = false
      }
    }

    prevMessageCountRef.current = newCount
  }, [messages])

  // Reset initial load flag when channel changes
  useEffect(() => {
    isInitialLoadRef.current = true
    prevMessageCountRef.current = 0
  }, [channelId])

  // Load older messages on scroll to top
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container || loading || !hasMore) return
    if (container.scrollTop < 50) {
      const prevHeight = container.scrollHeight
      loadMore().then(() => {
        // Maintain scroll position after prepending
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevHeight
          }
        })
      })
    }
  }, [loading, hasMore, loadMore])

  const handleEdit = async (message) => {
    const newContent = prompt('Edit message:', message.content)
    if (newContent === null || newContent.trim() === '' || newContent === message.content) return
    await editMessage(message.id, newContent.trim())
  }

  const handleDelete = async (message) => {
    if (!confirm('Delete this message?')) return
    await deleteMessage(message.id)
  }

  if (!channelId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="text-gray-400 text-sm">Select a channel to start messaging</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <ChannelHeader channel={channel} onBack={onBack} />

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-white"
        onScroll={handleScroll}
      >
        {/* Loading indicator for older messages */}
        {loading && hasMore && (
          <div className="text-center py-3">
            <span className="text-xs text-gray-400">Loading older messages...</span>
          </div>
        )}

        {/* Empty channel state */}
        {!loading && messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">
                This is the start of <span className="font-medium">#{channel?.name}</span>
              </p>
              {channel?.description && (
                <p className="text-xs text-gray-400 mt-1">{channel.description}</p>
              )}
            </div>
          </div>
        )}

        {/* Messages list */}
        <div className="max-w-4xl mx-auto py-2">
          {messages.map(message => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={(message.sender?.team_member_id || message.sender_id) === currentUser?.id}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
        <div ref={messagesEndRef} />
      </div>

      <MessageComposer onSend={sendMessage} disabled={!channelId} />
    </div>
  )
}
