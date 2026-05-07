'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'ga-consent'

export function getStoredConsent() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(STORAGE_KEY)
}

export function setStoredConsent(value) {
  localStorage.setItem(STORAGE_KEY, value)
  window.dispatchEvent(new Event('ga-consent-change'))
}

export function clearStoredConsent() {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event('ga-consent-change'))
}

export default function CookieConsent() {
  const [decided, setDecided] = useState(true)

  useEffect(() => {
    setDecided(getStoredConsent() !== null)
  }, [])

  if (decided) return null

  const choose = (value) => {
    setStoredConsent(value)
    setDecided(true)
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white p-4 shadow-lg sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm sm:rounded-lg sm:border"
    >
      <p className="text-sm text-gray-700">
        We use Google Analytics to understand how members use this site. No personal data is sold.
        You can change your choice anytime by clearing your browser&apos;s site data.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => choose('granted')}
          className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Accept
        </button>
        <button
          type="button"
          onClick={() => choose('denied')}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Decline
        </button>
      </div>
    </div>
  )
}
