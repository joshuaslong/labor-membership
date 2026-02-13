'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function MobileNav({ isLoggedIn, isAdmin, memberName }) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <div className="md:hidden">
      {/* Hamburger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
        aria-label="Toggle menu"
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-out Menu */}
      <div
        className={`fixed top-0 right-0 h-full w-72 max-w-[80vw] bg-labor-red-700 z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Menu Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/20">
          <span className="text-white font-medium truncate pr-2">
            {isLoggedIn ? (memberName || 'Menu') : 'Menu'}
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors ml-auto"
            aria-label="Close menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Menu Links */}
        <div className="py-4 px-2">
          <Link
            href="/chapters"
            className="block px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            Chapters
          </Link>
          <Link
            href="/initiatives"
            className="block px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            Initiatives
          </Link>
          <Link
            href="/contribute"
            className="block px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            Contribute
          </Link>
          <Link
            href="/events"
            className="block px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            Events
          </Link>
          <Link
            href="/volunteers"
            className="block px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            Volunteer
          </Link>

          {isLoggedIn ? (
            <>
              <Link
                href="/dashboard"
                className="block px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/profile"
                className="block px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                My Profile
              </Link>
              {isAdmin && (
                <>
                  <div className="my-4 border-t border-white/20" />
                  <Link
                    href="/admin"
                    className="block px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    Admin
                  </Link>
                  <Link
                    href="/members"
                    className="block px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    Members
                  </Link>
                </>
              )}

              <div className="my-4 border-t border-white/20" />

              <form action="/api/auth/logout" method="POST" className="px-2">
                <button
                  type="submit"
                  className="w-full px-4 py-3 text-left text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  Log out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/join"
                className="block px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                Join
              </Link>

              <div className="my-4 border-t border-white/20" />

              <div className="px-2">
                <Link
                  href="/login"
                  className="block w-full px-4 py-3 text-center font-medium bg-white text-labor-red rounded-lg hover:bg-white/90 transition-colors"
                >
                  Log in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
