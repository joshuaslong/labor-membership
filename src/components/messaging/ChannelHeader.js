'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePushSubscription } from '@/hooks/usePushSubscription'

export default function ChannelHeader({ channel }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [toggling, setToggling] = useState(false)
  const { isSupported, permission, subscription, subscribe } = usePushSubscription()

  if (!channel) return null

  // Fetch current notification preference when channel changes
  useEffect(() => {
    if (!channel?.id) return
    fetch(`/api/workspace/messaging/channels/${channel.id}/notifications`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setNotificationsEnabled(data.notifications_enabled)
      })
      .catch(() => {})
  }, [channel?.id])

  const handleToggle = useCallback(async () => {
    if (toggling) return
    setToggling(true)

    try {
      const newEnabled = !notificationsEnabled

      // If enabling and no push subscription yet, request permission + subscribe
      if (newEnabled && !subscription) {
        await subscribe()
      }

      const res = await fetch(
        `/api/workspace/messaging/channels/${channel.id}/notifications`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: newEnabled }),
        }
      )

      if (res.ok) {
        const data = await res.json()
        setNotificationsEnabled(data.notifications_enabled)
      }
    } catch (err) {
      console.error('Failed to toggle notifications:', err)
    } finally {
      setToggling(false)
    }
  }, [channel?.id, notificationsEnabled, subscription, subscribe, toggling])

  const showBell = isSupported && permission !== 'denied'

  return (
    <div className="border-b border-stone-200 bg-white px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-900 truncate">
            # {channel.name}
          </h2>
          {channel.description && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{channel.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          {showBell && (
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`p-1 rounded transition-colors ${
                notificationsEnabled
                  ? 'text-labor-red hover:text-red-700'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              title={notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}
            >
              {notificationsEnabled ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              )}
            </button>
          )}
          {channel.member_count != null && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{channel.member_count}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
