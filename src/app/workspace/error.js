'use client'

export default function WorkspaceError({ error, reset }) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center">
      <div className="bg-white border border-stone-200 rounded p-6 max-w-md">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-600 mb-4">{error.message || 'Unable to load workspace'}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-labor-red text-white rounded text-sm hover:bg-labor-red-600"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
