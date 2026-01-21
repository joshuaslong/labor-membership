'use client'

import { useState } from 'react'
import Link from 'next/link'

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
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/admin" className="text-red-700 hover:underline mb-4 inline-block">
        &larr; Back to Admin
      </Link>

      <h1 className="text-3xl text-gray-900 mb-2">Import Members</h1>
      <p className="text-gray-600 mb-8">
        Import members from Memberstack CSV export. Existing members (by email) will be updated with new fields.
      </p>

      <div className="card mb-6">
        <h2 className="font-semibold text-gray-900 mb-2">Expected CSV Format</h2>
        <p className="text-sm text-gray-600 mb-3">
          Tab or comma-delimited with these columns:
        </p>
        <code className="block bg-gray-100 p-3 rounded text-xs overflow-x-auto">
          email, CreatedAt, Last Login, First Name, Last Name, State, Zip Code, Phone-Number, Member Bio, Volunteering, Mailing List, Volunteering Details
        </code>
        <a
          href="/api/admin/import-members"
          className="text-red-700 hover:underline text-sm mt-3 inline-block"
        >
          Download sample template
        </a>
      </div>

      <div className="card mb-6 bg-blue-50 border-blue-200">
        <h2 className="font-semibold text-blue-900 mb-2">Data Normalization</h2>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><strong>Phone numbers:</strong> Converted to (XXX) XXX-XXXX format</li>
          <li><strong>States:</strong> Full names converted to 2-letter codes (e.g., "Pennsylvania" to "PA")</li>
          <li><strong>Mailing list:</strong> All members set to opted-in by default</li>
          <li><strong>Chapter assignment:</strong> Members automatically assigned to their state chapter</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="card">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            CSV File
          </label>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={(e) => setFile(e.target.files[0])}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {results && (
          <div className="bg-green-50 text-green-800 p-4 rounded-lg mb-4">
            <p className="font-semibold text-lg mb-3">Import Complete</p>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white/50 p-3 rounded">
                <p className="text-2xl font-bold">{results.total}</p>
                <p className="text-xs text-green-700">Total rows</p>
              </div>
              <div className="bg-white/50 p-3 rounded">
                <p className="text-2xl font-bold">{results.imported + (results.updated || 0)}</p>
                <p className="text-xs text-green-700">Imported/Updated</p>
              </div>
            </div>

            <ul className="text-sm space-y-1 mb-3">
              <li>New members: {results.imported}</li>
              <li>Updated existing: {results.updated || 0}</li>
              <li>Assigned to state chapters: {results.stateAssignments || 0}</li>
              <li>Phone numbers normalized: {results.phoneNormalized || 0}</li>
              <li>State names normalized: {results.stateNormalized || 0}</li>
              <li>Skipped: {results.skipped}</li>
            </ul>

            {results.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium">View errors ({results.errors.length})</summary>
                <ul className="text-xs mt-2 max-h-40 overflow-y-auto bg-white/30 p-2 rounded">
                  {results.errors.map((err, i) => (
                    <li key={i} className="py-1 border-b border-green-200">
                      {err.email || 'Unknown'}: {err.error}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={!file || loading}
          className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Importing...' : 'Import Members'}
        </button>
      </form>

      <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
        <h3 className="font-semibold text-yellow-800 mb-2">Note about Authentication</h3>
        <p className="text-sm text-yellow-700">
          Imported members will not have login accounts created automatically.
          When they try to log in with their email, they'll receive a magic link
          to verify their email and access their account.
        </p>
      </div>
    </div>
  )
}
