'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SyncButton() {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState(null)

  const handleSync = async () => {
    setSyncing(true)
    setResult(null)

    try {
      const res = await fetch('/api/stripe/sync', {
        method: 'POST',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Sync failed')
      }

      setResult({
        success: true,
        message: `Synced ${data.syncedSubscriptions} subscription(s) and ${data.syncedPayments} payment(s)`,
      })

      // Refresh the page to show new data
      router.refresh()
    } catch (err) {
      setResult({
        success: false,
        message: err.message,
      })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="text-sm text-gray-500 hover:text-labor-red disabled:opacity-50"
      >
        {syncing ? 'Syncing...' : 'Sync from Stripe'}
      </button>

      {result && (
        <p className={`text-xs mt-1 ${result.success ? 'text-green-600' : 'text-red-600'}`}>
          {result.message}
        </p>
      )}
    </div>
  )
}
