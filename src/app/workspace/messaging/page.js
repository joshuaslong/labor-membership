'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import ChannelSidebar from '@/components/messaging/ChannelSidebar'
import ChatArea from '@/components/messaging/ChatArea'
import CreateChannelModal from '@/components/messaging/CreateChannelModal'
import BrowseChannelsModal from '@/components/messaging/BrowseChannelsModal'
import { useUnreadCounts } from '@/hooks/useUnreadCounts'

export default function MessagingPage() {
  const searchParams = useSearchParams()
  const deepLinked = useRef(false)

  const [channels, setChannels] = useState([])
  const [allChannels, setAllChannels] = useState([])
  const [selectedChannelId, setSelectedChannelId] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showBrowseModal, setShowBrowseModal] = useState(false)
  const [chapterScope, setChapterScope] = useState(null)

  const unreadCounts = useUnreadCounts(channels)

  // Read current chapter scope from cookie
  const readChapterScope = useCallback(() => {
    const match = document.cookie.match(/chapter_scope=([^;]+)/)
    return match?.[1] || null
  }, [])

  // Fetch current user info
  useEffect(() => {
    fetch('/api/workspace/messaging/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.teamMember) setCurrentUser(data.teamMember)
      })
      .catch(() => {})
  }, [])

  // Fetch channels — pass chapter scope as query param so API doesn't depend on cookie
  const fetchChannels = useCallback(async (scope) => {
    setLoading(true)
    try {
      const params = scope ? `?chapter=${encodeURIComponent(scope)}` : ''
      const res = await fetch(`/api/workspace/messaging/channels${params}`)
      if (!res.ok) throw new Error('Failed to load channels')
      const data = await res.json()
      const all = Array.isArray(data) ? data : []
      setAllChannels(all)
      setChannels(all.filter(c => c.is_member))
    } catch {
      setChannels([])
      setAllChannels([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Refresh all channels for browse modal
  const fetchAllChannels = useCallback(async (scope) => {
    try {
      const params = scope ? `?chapter=${encodeURIComponent(scope)}` : ''
      const res = await fetch(`/api/workspace/messaging/channels${params}`)
      if (!res.ok) throw new Error('Failed to load channels')
      const data = await res.json()
      setAllChannels(Array.isArray(data) ? data : [])
    } catch {
      setAllChannels([])
    }
  }, [])

  // Initial load
  useEffect(() => {
    const scope = readChapterScope()
    setChapterScope(scope)
    fetchChannels(scope)
  }, [readChapterScope, fetchChannels])

  // Listen for chapter scope changes (cookie changes via custom event or polling)
  useEffect(() => {
    const handleChapterChange = () => {
      const newScope = readChapterScope()
      if (newScope !== chapterScope) {
        setChapterScope(newScope)
        setSelectedChannelId(null)
        fetchChannels(newScope)
      }
    }

    // Listen for custom event dispatched by ChapterSwitcher
    window.addEventListener('chapter-scope-changed', handleChapterChange)

    // Also poll for cookie changes as fallback
    const interval = setInterval(handleChapterChange, 2000)

    return () => {
      window.removeEventListener('chapter-scope-changed', handleChapterChange)
      clearInterval(interval)
    }
  }, [chapterScope, readChapterScope, fetchChannels])

  // Deep-link: auto-select channel from ?channel= URL param (e.g. from push notification)
  useEffect(() => {
    if (deepLinked.current || !channels.length) return
    const channelParam = searchParams.get('channel')
    if (channelParam && channels.some(c => c.id === channelParam)) {
      setSelectedChannelId(channelParam)
      deepLinked.current = true
      // Clean up URL
      window.history.replaceState({}, '', '/workspace/messaging')
    }
  }, [channels, searchParams])

  const selectedChannel = channels.find(c => c.id === selectedChannelId)

  const handleSelectChannel = (channelId) => {
    setSelectedChannelId(channelId)
  }

  const handleChannelCreated = (newChannel) => {
    setChannels(prev => [...prev, { ...newChannel, is_member: true, member_count: 1 }])
    setAllChannels(prev => [...prev, { ...newChannel, is_member: true, member_count: 1 }])
    setSelectedChannelId(newChannel.id)
  }

  const handleBrowseChannels = async () => {
    await fetchAllChannels(chapterScope)
    setShowBrowseModal(true)
  }

  const handleJoinChannel = async (channelId) => {
    const res = await fetch(`/api/workspace/messaging/channels/${channelId}/members`, {
      method: 'POST'
    })
    if (!res.ok) return

    // Refresh channels
    await fetchChannels(chapterScope)
    setSelectedChannelId(channelId)
  }

  const isAdmin = currentUser?.roles?.some(r =>
    ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin'].includes(r)
  ) ?? false

  // No chapter selected
  const scope = readChapterScope()
  if (scope === 'all' || (!scope && !loading)) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 64px)' }}>
        <div className="text-center">
          <p className="text-sm text-gray-500">Select a chapter to view messaging</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex" style={{ height: 'calc(100vh - 64px)' }}>
        <ChannelSidebar
          channels={channels}
          selectedChannelId={selectedChannelId}
          onSelectChannel={handleSelectChannel}
          onCreateChannel={() => setShowCreateModal(true)}
          onBrowseChannels={handleBrowseChannels}
          isAdmin={isAdmin}
          unreadCounts={unreadCounts}
        />
        {loading && !channels.length ? (
          <div className="flex-1 flex items-center justify-center bg-stone-50">
            <div className="animate-pulse space-y-3 w-48">
              <div className="h-3 bg-stone-200 rounded w-3/4"></div>
              <div className="h-3 bg-stone-200 rounded w-1/2"></div>
              <div className="h-3 bg-stone-200 rounded w-2/3"></div>
            </div>
          </div>
        ) : (
          <ChatArea
            channelId={selectedChannelId}
            channel={selectedChannel}
            currentUser={currentUser}
          />
        )}
      </div>

      <CreateChannelModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleChannelCreated}
        chapterId={chapterScope}
      />
      <BrowseChannelsModal
        isOpen={showBrowseModal}
        onClose={() => setShowBrowseModal(false)}
        channels={allChannels}
        onJoin={handleJoinChannel}
      />
    </>
  )
}
