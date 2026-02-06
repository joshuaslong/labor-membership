'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function EventRowActions({ eventId, eventTitle }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const menuRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete event')
      }

      setShowDeleteModal(false)
      router.refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="relative flex justify-end" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 rounded border border-stone-200 hover:bg-stone-50 text-gray-500 hover:text-gray-700"
          aria-label="Event actions"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM10 11.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM10 17a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1 w-36 bg-white border border-stone-200 rounded shadow-lg z-10">
            <Link
              href={`/events/${eventId}`}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-stone-50"
              onClick={() => setIsOpen(false)}
            >
              View
            </Link>
            <Link
              href={`/workspace/events/${eventId}`}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-stone-50"
              onClick={() => setIsOpen(false)}
            >
              Edit
            </Link>
            <button
              onClick={() => {
                setIsOpen(false)
                setShowDeleteModal(true)
              }}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !deleting && setShowDeleteModal(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Event
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete &quot;{eventTitle}&quot;? This action cannot be undone.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
