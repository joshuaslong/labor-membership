'use client'

import { useState, useEffect, useCallback } from 'react'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function syncSubscriptionToServer(sub) {
  const subJson = sub.toJSON()
  const res = await fetch('/api/workspace/messaging/push-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: subJson.endpoint,
      keys: subJson.keys,
    }),
  })
  if (!res.ok) {
    throw new Error('Failed to save subscription')
  }
}

export function usePushSubscription() {
  const [permission, setPermission] = useState('default')
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return

    setPermission(Notification.permission)

    navigator.serviceWorker.ready.then(reg => {
      reg.pushManager.getSubscription().then(sub => {
        setSubscription(sub)
      })
    })
  }, [])

  const subscribe = useCallback(async () => {
    if (!('Notification' in window) || !('PushManager' in window)) {
      throw new Error('Push notifications not supported')
    }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      throw new Error('Push configuration missing — contact admin')
    }

    setLoading(true)
    try {
      const result = await Notification.requestPermission()
      setPermission(result)

      if (result !== 'granted') {
        throw new Error('Permission denied')
      }

      const reg = await navigator.serviceWorker.ready

      // Check for existing browser subscription
      let sub = await reg.pushManager.getSubscription()

      if (sub) {
        // Existing subscription — sync it to server and return
        try {
          await syncSubscriptionToServer(sub)
          setSubscription(sub)
          return sub
        } catch (syncErr) {
          // Sync failed — unsubscribe stale one and create fresh
          console.warn('Push sync failed, recreating:', syncErr.message)
          await sub.unsubscribe().catch(() => {})
        }
      }

      // Create new subscription
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      setSubscription(sub)
      await syncSubscriptionToServer(sub)

      return sub
    } finally {
      setLoading(false)
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    if (!subscription) return

    setLoading(true)
    try {
      const endpoint = subscription.endpoint
      await subscription.unsubscribe()
      setSubscription(null)

      await fetch('/api/workspace/messaging/push-subscription', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      })
    } finally {
      setLoading(false)
    }
  }, [subscription])

  const isSupported = typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window

  return { isSupported, permission, subscription, loading, subscribe, unsubscribe }
}
