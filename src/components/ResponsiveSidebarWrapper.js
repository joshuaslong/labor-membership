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

  // Listen for toggle event from TopNav hamburger
  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev)
    window.addEventListener('toggle-sidebar', handleToggle)
    return () => window.removeEventListener('toggle-sidebar', handleToggle)
  }, [])

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [isOpen])

  return (
    <>
      {/* Desktop: sidebar in normal flow */}
      <div className="hidden md:block shrink-0">
        {children}
      </div>

      {/* Mobile drawer overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      {isOpen && (
        <div className="fixed inset-y-0 left-0 z-50 w-64 shadow-xl bg-white flex flex-col md:hidden">
          {/* Drawer header with close */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 shrink-0">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Menu</span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 -mr-1.5 rounded-lg hover:bg-stone-100 active:bg-stone-200"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Sidebar content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {children}
          </div>
        </div>
      )}
    </>
  )
}
