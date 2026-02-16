'use client'

import { useState, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function ResponsiveSidebarWrapper({ children }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)

  // Close on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname, searchParams])

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [isOpen])

  return (
    <>
      {/* Toggle button — mobile only */}
      <button
        className="md:hidden fixed top-[73px] left-3 z-20 bg-white/90 backdrop-blur-sm border border-stone-200 rounded-lg p-1.5 shadow-sm"
        onClick={() => setIsOpen(true)}
        aria-label="Open section menu"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Overlay — mobile only */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Desktop: in-flow block. Mobile: slide-in drawer when open, hidden when closed. */}
      <div className={`md:block ${isOpen ? 'fixed inset-y-0 left-0 z-50 shadow-xl' : 'hidden'}`}>
        {isOpen && (
          <button
            className="md:hidden absolute top-3 right-3 z-10 p-1 rounded hover:bg-stone-100"
            onClick={() => setIsOpen(false)}
            aria-label="Close section menu"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {children}
      </div>
    </>
  )
}
