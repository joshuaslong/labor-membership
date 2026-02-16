'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePushSubscription } from '@/hooks/usePushSubscription'

export default function ChannelHeader({ channel, onBack }) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [pushError, setPushError] = useState(null)
  const { isSupported, permission, subscription, subscribe } = usePushSubscription()

  const channelId = channel?.id

  // Fetch current notification preference when channel changes
  useEffect(() => {
    if (!channelId) return
    setPushError(null)
    fetch(`/api/workspace/messaging/channels/${channelId}/notifications`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setNotificationsEnabled(data.notifications_enabled)
      })
      .catch(() => {})
  }, [channelId])

  const handleToggle = useCallback(async () => {
    if (toggling || !channelId) return
    setToggling(true)
    setPushError(null)

    const newEnabled = !notificationsEnabled

    try {
      // When enabling, ensure push subscription exists first
      if (newEnabled) {
        if (!isSupported) {
          setPushError('Install this app to your home screen to receive push notifications.')
          setToggling(false)
          return
        }

        // Always attempt subscribe — it re-checks permission live from the OS
        try {
          await subscribe()
        } catch (err) {
          if (err.message === 'Permission denied') {
            setPushError('Notification permission is denied. On iPhone: close the app, go to Settings → Notifications → find this app → enable, then reopen.')
          } else {
            setPushError(err.message || 'Could not enable push notifications.')
          }
          setToggling(false)
          return
        }
      }

      // Optimistic update
      setNotificationsEnabled(newEnabled)

      const res = await fetch(
        `/api/workspace/messaging/channels/${channelId}/notifications`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: newEnabled }),
        }
      )

      if (!res.ok) {
        setNotificationsEnabled(!newEnabled)
        setPushError('Failed to save notification preference.')
      }
    } catch (err) {
      setNotificationsEnabled(!newEnabled)
      console.error('Failed to toggle notifications:', err)
    } finally {
      setToggling(false)
    }
  }, [channelId, notificationsEnabled, subscription, subscribe, isSupported, permission, toggling])

  if (!channel) return null

  return (
    <div className="border-b border-stone-200 bg-white px-4 py-3 sticky top-0 z-10 shrink-0">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="min-w-0 flex items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1 -ml-1 rounded hover:bg-stone-100"
              aria-label="Back to channels"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
          <h2 className="text-sm font-semibold text-gray-900 truncate">
            # {channel.name}
          </h2>
          {channel.description && (
            <p className="text-xs text-gray-500 truncate mt-0.5">{channel.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <div className="relative">
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                notificationsEnabled
                  ? 'text-labor-red bg-red-50 border border-red-200'
                  : 'text-gray-500 hover:text-gray-700 bg-stone-50 border border-stone-200 hover:bg-stone-100'
              }`}
              title={notificationsEnabled ? 'Disable notifications' : 'Enable notifications'}
            >
              {notificationsEnabled ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
              )}
              <span>{notificationsEnabled ? 'On' : 'Notify'}</span>
            </button>
            {pushError && (
              <div className="absolute right-0 top-full mt-1 w-56 p-2.5 bg-white border border-stone-200 rounded-lg shadow-lg z-20">
                <p className="text-xs text-gray-600 leading-relaxed">{pushError}</p>
                <button
                  onClick={() => setPushError(null)}
                  className="mt-1.5 text-xs text-gray-400 hover:text-gray-600"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
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
