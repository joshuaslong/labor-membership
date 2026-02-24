'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

const PAGE_SIZE = 50
const POLL_INTERVAL = 3000

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

  // Fetch recent messages from API and merge into state (with sender info)
  const fetchNewMessages = useCallback(async () => {
    if (!channelId) return
    try {
      const res = await fetch(
        `/api/workspace/messaging/channels/${channelId}/messages?limit=20`
      )
      if (!res.ok) return
      const data = await res.json()
      const latest = (data.messages || []).reverse().filter(m => !m.is_deleted)

      setMessages(prev => {
        const existingMap = new Map(prev.map(m => [m.id, m]))
        let changed = false

        // Update any existing messages that were edited
        const updated = prev.map(m => {
          const fresh = latest.find(f => f.id === m.id)
          if (fresh && (fresh.content !== m.content || fresh.is_edited !== m.is_edited)) {
            changed = true
            return { ...m, content: fresh.content, is_edited: fresh.is_edited }
          }
          return m
        })

        // Add any new messages not in our state
        const newMsgs = latest.filter(m => !existingMap.has(m.id))
        if (newMsgs.length > 0) {
          return [...updated, ...newMsgs]
        }

        return changed ? updated : prev
      })
    } catch {
      // Silent — polling failures are expected (offline, etc.)
    }
  }, [channelId])

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
          const fetched = data.messages?.reverse() || []
          setMessages(fetched.filter(m => !m.is_deleted))
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

  // Set up Realtime subscription — used as a fast trigger to fetch from API
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
        () => {
          // Fetch from API to get complete message with sender info
          fetchNewMessages()
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
          if (payload.new.is_deleted) {
            setMessages(prev => prev.filter(m => m.id !== payload.new.id))
          } else {
            // Keep existing sender info, only update content/flags
            setMessages(prev =>
              prev.map(m => m.id === payload.new.id
                ? { ...m, content: payload.new.content, is_edited: payload.new.is_edited }
                : m
              )
            )
          }
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
  }, [channelId, fetchNewMessages])

  // Polling fallback — fetch new messages every few seconds
  useEffect(() => {
    if (!channelId) return
    const interval = setInterval(() => {
      if (!document.hidden) fetchNewMessages()
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [channelId, fetchNewMessages])

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
    setMessages(prev => prev.filter(m => m.id !== messageId))
  }, [])

  return { messages, loading, hasMore, error, sendMessage, editMessage, deleteMessage, loadMore }
}
