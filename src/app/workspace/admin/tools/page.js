'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function AdminToolsPage() {
  const searchParams = useSearchParams()
  const activeTool = searchParams.get('tool') || 'import'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-5">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Admin Tools</h1>
      </div>

      {/* Tool tabs */}
      <div className="flex gap-1 mb-6 border-b border-stone-200">
        <ToolTab href="/workspace/admin/tools?tool=import" label="Import Members" active={activeTool === 'import'} />
        <ToolTab href="/workspace/admin/tools?tool=payments" label="Sync Payments" active={activeTool === 'payments'} />
        <ToolTab href="/workspace/admin/tools?tool=templates" label="Email Templates" active={activeTool === 'templates'} />
      </div>

      {activeTool === 'import' && <ImportTool />}
      {activeTool === 'payments' && <SyncPaymentsTool />}
      {activeTool === 'templates' && <EmailTemplatesTool />}
    </div>
  )
}

function ToolTab({ href, label, active }) {
  return (
    <Link
      href={href}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active
          ? 'border-labor-red text-gray-900'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-stone-300'
      }`}
    >
      {label}
    </Link>
  )
}

// ── Import Members Tool ──────────────────────────────────────────────
function ImportTool() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleImport = async (e) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const text = await file.text()
      const res = await fetch('/api/admin/import-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')

      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200 rounded">
        <div className="px-4 py-3 border-b border-stone-200">
          <h2 className="text-sm font-semibold text-gray-900">Import Members from CSV</h2>
          <p className="text-xs text-gray-400 mt-0.5">Upload a CSV file with member data to bulk import</p>
        </div>
        <div className="p-4">
          <form onSubmit={handleImport} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">CSV File</label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-gray-600 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-stone-200 file:text-sm file:font-medium file:bg-white file:text-gray-700 hover:file:bg-stone-50 file:cursor-pointer"
              />
              <p className="text-xs text-gray-400 mt-1">
                Expected columns: email, CreatedAt, Last Login, First Name, Last Name, State, Zip Code, Phone-Number, Member Bio, Volunteering, Mailing List, Volunteering Details, Donor, Organizer
              </p>
            </div>
            <button
              type="submit"
              disabled={loading || !file}
              className="px-4 py-2 text-sm font-medium text-white bg-labor-red rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Importing...' : 'Import Members'}
            </button>
          </form>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
      )}

      {result && (
        <div className="bg-white border border-stone-200 rounded">
          <div className="px-4 py-3 border-b border-stone-200">
            <h2 className="text-sm font-semibold text-gray-900">Import Results</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <ResultStat label="Total Rows" value={result.total || 0} />
              <ResultStat label="Imported" value={result.imported || 0} color="text-green-700" />
              <ResultStat label="Updated" value={result.updated || 0} color="text-blue-700" />
              <ResultStat label="Skipped" value={result.skipped || 0} color="text-gray-500" />
            </div>
            {result.stateAssignments > 0 && (
              <p className="text-xs text-gray-500">State assignments: {result.stateAssignments}</p>
            )}
            {result.errors?.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-medium text-red-600 uppercase tracking-wide mb-1">Errors</h3>
                <div className="max-h-40 overflow-y-auto text-xs text-red-600 space-y-0.5">
                  {result.errors.map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sync Payments Tool ───────────────────────────────────────────────
function SyncPaymentsTool() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const res = await fetch('/api/admin/sync-payments?action=stats')
      const data = await res.json()
      setStats(data)
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const runSync = async (action) => {
    setSyncing(action)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/admin/sync-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')

      setResult(data)
      loadStats()
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Current Stats */}
      <div className="bg-white border border-stone-200 rounded">
        <div className="px-4 py-3 border-b border-stone-200">
          <h2 className="text-sm font-semibold text-gray-900">Payment Statistics</h2>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="animate-pulse grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-gray-100 rounded" />)}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ResultStat label="Total Payments" value={stats.total || 0} />
              <ResultStat label="Succeeded" value={stats.succeeded || 0} color="text-green-700" />
              <ResultStat label="Total Revenue" value={`$${((stats.revenue || 0) / 100).toLocaleString()}`} color="text-green-700" />
              <ResultStat label="Failed/Pending" value={stats.failed || 0} color="text-red-700" />
            </div>
          ) : (
            <p className="text-sm text-gray-400">Could not load payment stats</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white border border-stone-200 rounded">
        <div className="px-4 py-3 border-b border-stone-200">
          <h2 className="text-sm font-semibold text-gray-900">Sync Operations</h2>
        </div>
        <div className="p-4 space-y-3">
          <SyncAction
            label="Sync All Payments"
            desc="Fetch charges from Stripe and match to members by email"
            onClick={() => runSync('sync')}
            loading={syncing === 'sync'}
            disabled={!!syncing}
          />
          <SyncAction
            label="Remove Duplicates"
            desc="Clean duplicate payments (same member, amount, within 5 minutes)"
            onClick={() => runSync('dedup')}
            loading={syncing === 'dedup'}
            disabled={!!syncing}
          />
          <SyncAction
            label="Fix Payment Types"
            desc="Re-check each payment to correct one-time vs. recurring labels"
            onClick={() => runSync('fix-types')}
            loading={syncing === 'fix-types'}
            disabled={!!syncing}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">{error}</div>
      )}

      {result && (
        <div className="bg-white border border-stone-200 rounded">
          <div className="px-4 py-3 border-b border-stone-200">
            <h2 className="text-sm font-semibold text-gray-900">Sync Results</h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {result.total != null && <ResultStat label="Total Found" value={result.total} />}
              {result.added != null && <ResultStat label="New Added" value={result.added} color="text-green-700" />}
              {result.existing != null && <ResultStat label="Already Existed" value={result.existing} />}
              {result.removed != null && <ResultStat label="Removed" value={result.removed} color="text-amber-700" />}
              {result.fixed != null && <ResultStat label="Fixed" value={result.fixed} color="text-blue-700" />}
              {result.unmatched != null && <ResultStat label="Unmatched" value={result.unmatched} color="text-gray-500" />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Email Templates Tool ─────────────────────────────────────────────
function EmailTemplatesTool() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedKey, setSelectedKey] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/admin/email-templates')
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (err) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }

  const selectTemplate = (t) => {
    setSelectedKey(t.key)
    setEditing({
      subject: t.subject || '',
      content: t.content || '',
      enabled: t.enabled ?? true,
    })
    setError(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/email-templates/${selectedKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      loadTemplates()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const selected = templates.find(t => t.key === selectedKey)

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Template List */}
      <div className="bg-white border border-stone-200 rounded">
        <div className="px-4 py-3 border-b border-stone-200">
          <h2 className="text-sm font-semibold text-gray-900">Templates</h2>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {templates.map(t => (
              <button
                key={t.key}
                onClick={() => selectTemplate(t)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  selectedKey === t.key ? 'bg-gray-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-900">{t.name || t.key}</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${
                    t.enabled ? 'text-green-700 bg-green-50 border-green-200' : 'text-gray-500 bg-stone-50 border-stone-200'
                  }`}>
                    {t.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </button>
            ))}
            {templates.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No templates configured</div>
            )}
          </div>
        )}
      </div>

      {/* Template Editor */}
      <div className="lg:col-span-2">
        {editing && selected ? (
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">{selected.name || selected.key}</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.enabled}
                  onChange={(e) => setEditing(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="rounded border-gray-300 text-labor-red focus:ring-labor-red"
                />
                <span className="text-xs text-gray-500">Enabled</span>
              </label>
            </div>
            <div className="p-4 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Subject</label>
                <input
                  type="text"
                  value={editing.subject}
                  onChange={(e) => setEditing(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Content (HTML)</label>
                <textarea
                  value={editing.content}
                  onChange={(e) => setEditing(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-stone-200 rounded bg-white text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red min-h-64"
                  rows={12}
                />
              </div>

              <div className="bg-stone-50 rounded p-3">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Available Variables</h3>
                <div className="flex flex-wrap gap-1">
                  {['{{name}}', '{{email}}', '{{event_name}}', '{{event_date}}', '{{event_time}}', '{{event_location}}', '{{amount}}', '{{date}}', '{{payment_type}}'].map(v => (
                    <code key={v} className="px-1.5 py-0.5 bg-white border border-stone-200 rounded text-xs text-gray-600">{v}</code>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-white bg-labor-red rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Template'}
                </button>
                <button
                  onClick={() => { setSelectedKey(null); setEditing(null) }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded p-12 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <p className="text-sm text-gray-500">Select a template to edit</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared Components ────────────────────────────────────────────────
function ResultStat({ label, value, color }) {
  return (
    <div className="bg-stone-50 border border-stone-200 rounded px-3 py-2">
      <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-semibold tabular-nums mt-0.5 ${color || 'text-gray-900'}`}>{value}</div>
    </div>
  )
}

function SyncAction({ label, desc, onClick, loading, disabled }) {
  return (
    <div className="flex items-center justify-between p-3 border border-stone-200 rounded">
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-400">{desc}</div>
      </div>
      <button
        onClick={onClick}
        disabled={disabled}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50 disabled:opacity-50 transition-colors flex-shrink-0"
      >
        {loading ? 'Running...' : 'Run'}
      </button>
    </div>
  )
}
