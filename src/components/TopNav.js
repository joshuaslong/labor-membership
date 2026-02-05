'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function TopNav({ sections = [] }) {
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
            <nav className="flex gap-4">
              {sections.map(section => (
                <Link
                  key={section}
                  href={section === 'workspace' ? '/workspace' : `/${section}`}
                  className={`text-sm font-medium ${
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
            <Link href="/api/auth/logout" className="text-sm text-gray-700 hover:text-gray-900">
              Logout
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
