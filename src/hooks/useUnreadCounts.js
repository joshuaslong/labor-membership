'use client'

import { useMemo } from 'react'

export function useUnreadCounts(channels) {
  const unreadMap = useMemo(() => {
    const map = {}
    if (!channels || !Array.isArray(channels)) return map

    for (const channel of channels) {
      if (!channel.last_read_at) {
        // Never read — count all messages as unread
        map[channel.id] = channel.unread_count ?? 0
      } else if (channel.latest_message_at) {
        const lastRead = new Date(channel.last_read_at)
        const latestMsg = new Date(channel.latest_message_at)
        if (latestMsg > lastRead) {
          map[channel.id] = channel.unread_count ?? 1
        } else {
          map[channel.id] = 0
        }
      } else {
        map[channel.id] = 0
      }
    }

    return map
  }, [channels])

  return unreadMap
}
