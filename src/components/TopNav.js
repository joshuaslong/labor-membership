'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import PropTypes from 'prop-types'

/**
 * TopNav component provides the main navigation bar for the application.
 * Displays navigation links for different sections and a logout option.
 *
 * @component
 * @param {Object} props - Component props
 * @param {string[]} props.sections - Array of section identifiers to display in navigation
 * @returns {JSX.Element} The rendered navigation bar
 */
function TopNav({ sections = [] }) {
  const pathname = usePathname()

  const isActive = (section) => {
    if (section === 'workspace') return pathname === '/workspace'
    return pathname.startsWith(`/${section}`)
  }

  const sectionLabels = {
    workspace: 'Workspace',
    members: 'Members',
    events: 'Events',
    communicate: 'Communicate',
    chapters: 'Chapters',
    resources: 'Resources',
    tasks: 'Tasks',
    admin: 'Admin'
  }

  return (
    <div className="border-b border-stone-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-6">
            <Link href="/workspace" className="text-lg font-semibold text-gray-900">
              Labor Party
            </Link>
            <nav aria-label="Main navigation" className="flex gap-4">
              {sections.map(section => (
                <Link
                  key={section}
                  href={section === 'workspace' ? '/workspace' : `/${section}`}
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
          <div>
            {/* User menu placeholder */}
            <Link
              href="/api/auth/logout"
              className="text-sm text-gray-700 hover:text-gray-900"
              aria-label="Log out of your account"
            >
              Logout
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

TopNav.displayName = 'TopNav'

TopNav.propTypes = {
  sections: PropTypes.arrayOf(PropTypes.string)
}

export default TopNav
