'use client'

import { useState } from 'react'

export default function ImportMembersPage() {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!file) return

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/admin/import-members', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setResults(data.results)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Import Members</h1>
        <p className="text-sm text-gray-600 mt-1">
          Import from CSV export. Existing members matched by email will be updated.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upload form - 2/3 width */}
        <div className="lg:col-span-2 space-y-4">
          <form onSubmit={handleSubmit} className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">Upload CSV</h2>
            </div>
            <div className="p-4">
              <div className="border-2 border-dashed border-stone-200 rounded p-6 text-center">
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-stone-200 file:text-sm file:font-medium file:bg-white file:text-gray-700 hover:file:bg-stone-50 file:cursor-pointer"
                />
                {file && (
                  <p className="text-xs text-gray-500 mt-2">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
                )}
              </div>

              {error && (
                <div className="mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!file || loading}
                className="mt-4 w-full px-4 py-2 bg-labor-red text-white text-sm font-medium rounded hover:bg-labor-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Importing...' : 'Import Members'}
              </button>
            </div>
          </form>

          {/* Results */}
          {results && (
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <h2 className="text-sm font-semibold text-gray-900">Import Complete</h2>
              </div>

              <div className="grid grid-cols-4 border-b border-stone-200">
                <div className="p-4 text-center border-r border-stone-100">
                  <div className="text-2xl font-semibold text-gray-900 tabular-nums">{results.total}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Total rows</div>
                </div>
                <div className="p-4 text-center border-r border-stone-100">
                  <div className="text-2xl font-semibold text-green-700 tabular-nums">{results.imported}</div>
                  <div className="text-xs text-gray-500 mt-0.5">New</div>
                </div>
                <div className="p-4 text-center border-r border-stone-100">
                  <div className="text-2xl font-semibold text-blue-700 tabular-nums">{results.updated || 0}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Updated</div>
                </div>
                <div className="p-4 text-center">
                  <div className={`text-2xl font-semibold tabular-nums ${results.skipped > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{results.skipped}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Skipped</div>
                </div>
              </div>

              <div className="p-4">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-stone-100">
                    <tr>
                      <td className="py-1.5 text-gray-500">State chapters assigned</td>
                      <td className="py-1.5 text-gray-900 text-right tabular-nums">{results.stateAssignments || 0}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-gray-500">Phone numbers normalized</td>
                      <td className="py-1.5 text-gray-900 text-right tabular-nums">{results.phoneNormalized || 0}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-gray-500">State names normalized</td>
                      <td className="py-1.5 text-gray-900 text-right tabular-nums">{results.stateNormalized || 0}</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 text-gray-500">Segments applied</td>
                      <td className="py-1.5 text-gray-900 text-right tabular-nums">{results.segmentsApplied || 0}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {results.errors.length > 0 && (
                <div className="border-t border-stone-200">
                  <details>
                    <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-stone-50">
                      {results.errors.length} error{results.errors.length !== 1 ? 's' : ''}
                    </summary>
                    <div className="px-4 pb-3 max-h-48 overflow-y-auto">
                      <table className="w-full text-xs">
                        <tbody className="divide-y divide-stone-100">
                          {results.errors.map((err, i) => (
                            <tr key={i}>
                              <td className="py-1.5 text-gray-500 font-mono">{err.email || 'Unknown'}</td>
                              <td className="py-1.5 text-red-600 text-right">{err.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar info - 1/3 width */}
        <div className="space-y-4">
          {/* CSV Format */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">CSV Format</h2>
            </div>
            <div className="p-4">
              <p className="text-xs text-gray-600 mb-3">Tab or comma-delimited with columns:</p>
              <div className="bg-stone-50 border border-stone-200 rounded p-2">
                <code className="text-xs text-gray-700 leading-relaxed break-all">
                  email, CreatedAt, Last Login, First Name, Last Name, State, Zip Code, Phone-Number, Member Bio, Volunteering, Mailing List, Volunteering Details, Donor, Organizer
                </code>
              </div>
              <a
                href="/api/admin/import-members"
                className="inline-flex items-center gap-1 text-xs text-labor-red hover:underline mt-3"
              >
                Download template
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                </svg>
              </a>
            </div>
          </div>

          {/* Normalization rules */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">Auto-normalization</h2>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="text-xs font-medium text-gray-900">Phone numbers</div>
                <div className="text-xs text-gray-500">(XXX) XXX-XXXX format</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-900">States</div>
                <div className="text-xs text-gray-500">Full names to 2-letter codes</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-900">Chapter assignment</div>
                <div className="text-xs text-gray-500">Auto-assigned by state</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-900">Segments</div>
                <div className="text-xs text-gray-500">Volunteer, Donor, Organizer from CSV. New members auto-tagged.</div>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-900">Mailing list</div>
                <div className="text-xs text-gray-500">Opted-in by default</div>
              </div>
            </div>
          </div>

          {/* Auth note */}
          <div className="bg-stone-50 border border-stone-200 rounded p-4">
            <div className="text-xs font-medium text-gray-700 mb-1">About authentication</div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Imported members won't have login accounts. They'll receive a magic link to verify when they first log in.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
