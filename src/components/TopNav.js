'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import PropTypes from 'prop-types'

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
    <div className="border-b border-stone-200 bg-white sticky top-0 z-30">
      <div className="px-4 sm:px-6">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-6">
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
