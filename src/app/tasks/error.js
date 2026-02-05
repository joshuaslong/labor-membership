'use client'

export default function TasksError({ error, reset }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="bg-white border border-stone-200 rounded p-6 text-center">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to load tasks</h2>
        <p className="text-sm text-gray-600 mb-4">{error.message || 'An error occurred'}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-labor-red text-white rounded hover:bg-labor-red-600"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
