'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const PAGE_SIZE = 50

export function useChannel(channelId) {
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
          setMessages(prev => [...prev, payload.new])
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
      .subscribe()

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
    // Message will arrive via Realtime subscription
  }, [channelId])

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

  return { messages, loading, hasMore, error, sendMessage, loadMore }
}
