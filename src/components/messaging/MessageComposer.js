'use client'

import { useState, useRef, useCallback } from 'react'

export default function MessageComposer({ onSend, disabled }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef(null)

  const handleSubmit = useCallback(async () => {
    if (!text.trim() || disabled || sending) return

    setSending(true)
    try {
      await onSend(text)
      setText('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    } catch {
      // Error is handled by the parent
    } finally {
      setSending(false)
    }
  }, [text, disabled, sending, onSend])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleInput = (e) => {
    setText(e.target.value)
    // Auto-resize textarea
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  return (
    <div className="border-t border-stone-200 bg-white px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Select a channel to start messaging' : 'Type a message...'}
          disabled={disabled || sending}
          rows={1}
          className="flex-1 resize-none rounded border border-stone-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-stone-400 disabled:bg-stone-50 disabled:text-gray-400"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || sending || !text.trim()}
          className="shrink-0 rounded bg-labor-red px-3 py-2 text-sm font-medium text-white hover:bg-labor-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </div>
  )
}
