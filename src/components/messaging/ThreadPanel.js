'use client'

import { useEffect, useRef } from 'react'
import { useThread } from '@/hooks/useChannel'
import MessageBubble from './MessageBubble'
import MessageComposer from './MessageComposer'

export default function ThreadPanel({ parentMessageId, channelId, currentUser, onClose }) {
  const {
    parentMessage,
    replies,
    loading,
    error,
    sendReply,
    editReply,
    deleteReply,
    reactToReply,
  } = useThread(parentMessageId, channelId, currentUser)

  const repliesEndRef = useRef(null)
  const prevReplyCountRef = useRef(0)

  // Auto-scroll to bottom on new replies
  useEffect(() => {
    const prevCount = prevReplyCountRef.current
    const newCount = replies.length
    if (newCount > prevCount) {
      repliesEndRef.current?.scrollIntoView({ behavior: prevCount === 0 ? 'instant' : 'smooth' })
    }
    prevReplyCountRef.current = newCount
  }, [replies])

  const handleEdit = async (message) => {
    const newContent = prompt('Edit message:', message.content)
    if (newContent === null || newContent.trim() === '' || newContent === message.content) return
    await editReply(message.id, newContent.trim())
  }

  const handleDelete = async (message) => {
    if (!confirm('Delete this reply?')) return
    await deleteReply(message.id)
  }

  const handleReact = async (messageId, emoji) => {
    await reactToReply(messageId, emoji)
  }

  return (
    <div className="w-full md:w-96 border-l border-stone-200 bg-white flex flex-col h-full">
      {/* Thread header */}
      <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-gray-900">Thread</h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-stone-100 text-gray-400 hover:text-gray-600"
          aria-label="Close thread"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Thread content */}
      <div className="flex-1 overflow-y-auto">
        {loading && !parentMessage && (
          <div className="flex items-center justify-center py-12">
            <span className="text-xs text-gray-400">Loading thread...</span>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 text-xs text-red-600">{error}</div>
        )}

        {parentMessage && (
          <>
            {/* Parent message */}
            <div className="border-b border-stone-100">
              <MessageBubble
                message={parentMessage}
                isOwn={(parentMessage.sender?.team_member_id || parentMessage.sender_id) === currentUser?.id}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReact={handleReact}
                channelId={channelId}
                isThreadView
              />
            </div>

            {/* Reply count divider */}
            <div className="px-4 py-2 border-b border-stone-100">
              <span className="text-xs text-gray-500">
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </span>
            </div>

            {/* Replies */}
            <div className="py-1">
              {replies.map(reply => (
                <MessageBubble
                  key={reply.id}
                  message={reply}
                  isOwn={(reply.sender?.team_member_id || reply.sender_id) === currentUser?.id}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onReact={handleReact}
                  channelId={channelId}
                  isThreadView
                />
              ))}
            </div>
            <div ref={repliesEndRef} />
          </>
        )}
      </div>

      {/* Reply composer */}
      <MessageComposer
        onSend={sendReply}
        disabled={!parentMessageId}
        channelId={channelId}
        placeholder="Reply..."
      />
    </div>
  )
}
