'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import PropTypes from 'prop-types'
import ChapterSwitcher from '@/components/ChapterSwitcher'

// Sections that have a contextual sidebar on their pages
const SECTIONS_WITH_SIDEBAR = ['events', 'communicate', 'resources', 'polls', 'volunteers', 'tasks', 'admin', 'members', 'chapters']

function TopNav({ sections = [], availableChapters = [], selectedChapterId = 'all', showAllOption = false }) {
  const pathname = usePathname()

  const isActive = (section) => {
    if (section === 'workspace') return pathname === '/workspace'
    return pathname.startsWith(`/workspace/${section}`)
  }

  // Show hamburger on mobile when current section has a sidebar
  const currentSection = pathname.split('/')[2] || ''
  const hasSidebar = SECTIONS_WITH_SIDEBAR.includes(currentSection)

  const sectionLabels = {
    workspace: 'Workspace',
    events: 'Events',
    communicate: 'Email',
    messaging: 'Messages',
    resources: 'Resources',
    polls: 'Polls',
    volunteers: 'Volunteers',
    tasks: 'Tasks',
    admin: 'Admin'
  }

  return (
    <div className="border-b border-stone-200 bg-white sticky top-0 z-30">
      <div className="px-4 sm:px-6">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-6">
            {/* Mobile sidebar hamburger */}
            {hasSidebar && (
              <button
                className="md:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-stone-100 active:bg-stone-200"
                onClick={() => window.dispatchEvent(new CustomEvent('toggle-sidebar'))}
                aria-label="Open section menu"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              </button>
            )}
            <Link href="/workspace" className="flex-shrink-0">
              <Image
                src="/logo-workspace.png"
                alt="Labor Party"
                width={160}
                height={32}
                className="h-7 w-auto"
                priority
              />
            </Link>
            <nav aria-label="Main navigation" className="hidden md:flex gap-4 mt-1">
              {sections.map(section => (
                <Link
                  key={section}
                  href={section === 'workspace' ? '/workspace' : `/workspace/${section}`}
                  className={`text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-labor-red ${
                    isActive(section)
                      ? 'text-labor-red border-b-2 border-labor-red pb-1'
                      : 'text-gray-700 hover:text-gray-900 pb-1'
                  }`}
                >
                  {sectionLabels[section]}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            {availableChapters.length > 1 && (
              <ChapterSwitcher
                chapters={availableChapters}
                selectedChapterId={selectedChapterId}
                showAll={showAllOption}
              />
            )}
            <form action="/api/auth/logout" method="POST" className="hidden md:inline">
              <button
                type="submit"
                className="text-sm text-gray-700 hover:text-gray-900"
                aria-label="Log out of your account"
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

TopNav.displayName = 'TopNav'

TopNav.propTypes = {
  sections: PropTypes.arrayOf(PropTypes.string),
  availableChapters: PropTypes.array,
  selectedChapterId: PropTypes.string,
  showAllOption: PropTypes.bool
}

export default TopNav
