'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const PAGE_SIZE = 50

export function useChannel(channelId, currentUser) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState(null)
  const supabaseRef = useRef(null)
  const channelRef = useRef(null)

  // Initialize supabase client once
  if (!supabaseRef.current) {
    supabaseRef.current = createClient()
  }

  // Fetch initial messages
  useEffect(() => {
    if (!channelId) {
      setMessages([])
      setHasMore(true)
      return
    }

    let cancelled = false

    async function fetchMessages() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/workspace/messaging/channels/${channelId}/messages?limit=${PAGE_SIZE}`
        )
        if (!res.ok) throw new Error('Failed to load messages')
        const data = await res.json()
        if (!cancelled) {
          // API returns newest first; reverse so oldest is first for display
          setMessages(data.messages?.reverse() || [])
          setHasMore((data.messages?.length || 0) >= PAGE_SIZE)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchMessages()
    return () => { cancelled = true }
  }, [channelId])

  // Set up Realtime subscription
  useEffect(() => {
    if (!channelId) return

    const supabase = supabaseRef.current
    const realtimeChannel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => {
          setMessages(prev => {
            // Avoid duplicates (optimistic update may have already added it)
            if (prev.some(m => m.id === payload.new.id)) return prev
            return [...prev, payload.new]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`
        },
        (payload) => {
          setMessages(prev =>
            prev.map(m => m.id === payload.new.id ? payload.new : m)
          )
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`Realtime subscription ${status}`, err)
        }
      })

    channelRef.current = realtimeChannel

    return () => {
      supabase.removeChannel(realtimeChannel)
      channelRef.current = null
    }
  }, [channelId])

  const sendMessage = useCallback(async (content) => {
    if (!channelId || !content.trim()) return

    const res = await fetch(
      `/api/workspace/messaging/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() })
      }
    )
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to send message')
    }

    const message = await res.json()

    // Optimistically add to local state with sender info for display
    setMessages(prev => {
      if (prev.some(m => m.id === message.id)) return prev
      return [...prev, {
        ...message,
        sender: {
          team_member_id: message.sender_id,
          first_name: currentUser?.first_name || null,
          last_name: currentUser?.last_name || null,
        }
      }]
    })
  }, [channelId, currentUser])

  const loadMore = useCallback(async () => {
    if (!channelId || loading || !hasMore || messages.length === 0) return

    const oldestMessage = messages[0]
    setLoading(true)
    try {
      const res = await fetch(
        `/api/workspace/messaging/channels/${channelId}/messages?limit=${PAGE_SIZE}&cursor=${oldestMessage.id}`
      )
      if (!res.ok) throw new Error('Failed to load messages')
      const data = await res.json()
      const older = data.messages?.reverse() || []
      setMessages(prev => [...older, ...prev])
      setHasMore(older.length >= PAGE_SIZE)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [channelId, loading, hasMore, messages])

  const editMessage = useCallback(async (messageId, content) => {
    const res = await fetch(`/api/workspace/messaging/messages/${messageId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to edit message')
    }
    const updated = await res.json()
    setMessages(prev => prev.map(m => m.id === messageId
      ? { ...m, content: updated.content, is_edited: true }
      : m
    ))
  }, [])

  const deleteMessage = useCallback(async (messageId) => {
    const res = await fetch(`/api/workspace/messaging/messages/${messageId}`, {
      method: 'DELETE'
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Failed to delete message')
    }
    setMessages(prev => prev.map(m => m.id === messageId
      ? { ...m, is_deleted: true, content: null }
      : m
    ))
  }, [])

  return { messages, loading, hasMore, error, sendMessage, editMessage, deleteMessage, loadMore }
}
