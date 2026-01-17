'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function SyncPaymentsPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [fixing, setFixing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [cleanupResult, setCleanupResult] = useState(null)
  const [fixResult, setFixResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/sync-payments')
      if (!res.ok) throw new Error('Failed to load stats')
      const data = await res.json()
      setStats(data)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    setError(null)

    try {
      const res = await fetch('/api/admin/sync-payments', {
        method: 'POST',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Sync failed')
      }
      const data = await res.json()
      setSyncResult(data.results)
      // Reload stats after sync
      await loadStats()
    } catch (err) {
      setError(err.message)
    }

    setSyncing(false)
  }

  const handleCleanup = async () => {
    if (!confirm('This will remove duplicate payments (same member, same amount, within 5 minutes). Continue?')) {
      return
    }

    setCleaning(true)
    setCleanupResult(null)
    setError(null)

    try {
      const res = await fetch('/api/admin/sync-payments', {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Cleanup failed')
      }
      const data = await res.json()
      setCleanupResult(data)
      // Reload stats after cleanup
      await loadStats()
    } catch (err) {
      setError(err.message)
    }

    setCleaning(false)
  }

  const handleFixTypes = async () => {
    setFixing(true)
    setFixResult(null)
    setError(null)

    try {
      const res = await fetch('/api/admin/sync-payments', {
        method: 'PATCH',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Fix failed')
      }
      const data = await res.json()
      setFixResult(data)
      // Reload stats after fixing
      await loadStats()
    } catch (err) {
      setError(err.message)
    }

    setFixing(false)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/admin" className="text-gray-500 hover:text-gray-700 text-sm mb-4 inline-block">
        &larr; Back to Admin Dashboard
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Sync Stripe Payments</h1>
      <p className="text-gray-600 mb-8">
        Pull historical payments from Stripe that may have been missed by webhooks.
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Current Stats */}
      <div className="card mb-6">
        <h2 className="text-xl font-bold mb-4">Current Payment Stats</h2>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500">Total Payments</div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Succeeded</div>
              <div className="text-2xl font-bold text-green-600">{stats.succeeded}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Revenue</div>
              <div className="text-2xl font-bold text-green-600">${stats.totalRevenue?.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Failed/Pending</div>
              <div className="text-2xl font-bold text-gray-400">{(stats.failed || 0) + (stats.pending || 0)}</div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Sync Button */}
      <div className="card mb-6">
        <h2 className="text-xl font-bold mb-4">Sync from Stripe</h2>
        <p className="text-gray-600 mb-4">
          This will fetch all charges from Stripe and match them to members by email.
          New payments will be added to the database.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSync}
            disabled={syncing || cleaning || fixing}
            className="btn-primary"
          >
            {syncing ? 'Syncing...' : 'Sync All Payments'}
          </button>
          <button
            onClick={handleCleanup}
            disabled={syncing || cleaning || fixing}
            className="btn-secondary"
          >
            {cleaning ? 'Cleaning...' : 'Remove Duplicates'}
          </button>
          <button
            onClick={handleFixTypes}
            disabled={syncing || cleaning || fixing}
            className="btn-secondary"
          >
            {fixing ? 'Fixing...' : 'Fix Payment Types'}
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          "Fix Payment Types" re-checks each payment against Stripe to correct one-time vs recurring labels.
        </p>
      </div>

      {/* Cleanup Results */}
      {cleanupResult && (
        <div className="card mb-6 bg-yellow-50">
          <h2 className="text-xl font-bold mb-4">Cleanup Results</h2>
          <p className="text-gray-700">
            Found {cleanupResult.duplicatesFound} duplicate payments.
            Deleted {cleanupResult.deleted} records.
          </p>
        </div>
      )}

      {/* Fix Types Results */}
      {fixResult && (
        <div className="card mb-6 bg-blue-50">
          <h2 className="text-xl font-bold mb-4">Fix Payment Types Results</h2>
          <p className="text-gray-700">
            Checked {fixResult.paymentsChecked} payments.
            Fixed {fixResult.fixed} payment type labels.
          </p>
        </div>
      )}

      {/* Sync Results */}
      {syncResult && (
        <div className="card mb-6">
          <h2 className="text-xl font-bold mb-4">Sync Results</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-500">Total Charges Found</div>
              <div className="text-xl font-bold">{syncResult.totalCharges}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">New Payments Added</div>
              <div className="text-xl font-bold text-green-600">{syncResult.newPayments}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Already Existed</div>
              <div className="text-xl font-bold text-gray-500">{syncResult.updatedPayments}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Unmatched</div>
              <div className="text-xl font-bold text-yellow-600">{syncResult.unmatchedPayments}</div>
            </div>
          </div>

          {syncResult.errors?.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium text-gray-700 mb-2">Unmatched/Errors ({syncResult.errors.length})</h3>
              <div className="max-h-60 overflow-y-auto bg-gray-50 rounded p-3 text-sm">
                {syncResult.errors.map((err, i) => (
                  <div key={i} className="mb-2 pb-2 border-b border-gray-200 last:border-0">
                    <div className="text-gray-600">
                      {err.email && <span>Email: {err.email}</span>}
                      {err.amount && <span className="ml-2">${err.amount}</span>}
                    </div>
                    <div className="text-red-600 text-xs">{err.error}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Payments */}
      {stats?.payments?.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Recent Payments in Database</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Amount</th>
                  <th className="text-left py-2">Type</th>
                  <th className="text-left py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.payments.map(p => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="py-2">${(p.amount_cents / 100).toFixed(2)}</td>
                    <td className="py-2 capitalize">{p.payment_type?.replace('_', ' ')}</td>
                    <td className="py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        p.status === 'succeeded' ? 'bg-green-100 text-green-700' :
                        p.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
