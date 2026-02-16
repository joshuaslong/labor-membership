'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const PRIORITY = ['messaging', 'events', 'tasks', 'admin']

const labels = {
  workspace: 'Home',
  messaging: 'Messages',
  events: 'Events',
  tasks: 'Tasks',
  admin: 'Admin',
  communicate: 'Email',
  resources: 'Resources',
  polls: 'Polls',
  volunteers: 'Volunteers',
}

function Icon({ name, className = 'w-5 h-5' }) {
  const props = { className, fill: 'none', viewBox: '0 0 24 24', strokeWidth: 1.5, stroke: 'currentColor' }

  switch (name) {
    case 'workspace':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
    case 'messaging':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25z" /></svg>
    case 'events':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
    case 'tasks':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    case 'admin':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    case 'communicate':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
    case 'resources':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" /></svg>
    case 'polls':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
    case 'volunteers':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
    case 'more':
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
    default:
      return null
  }
}

export default function MobileTabBar({ sections = [] }) {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)

  // Close More popup on route change
  useEffect(() => {
    setShowMore(false)
  }, [pathname])

  // Split sections into priority visible tabs and overflow
  const nonHome = sections.filter(s => s !== 'workspace')
  const priorityTabs = PRIORITY.filter(s => nonHome.includes(s))
  const overflowTabs = nonHome.filter(s => !PRIORITY.includes(s))

  const maxVisible = overflowTabs.length > 0 ? 3 : 4
  const visibleTabs = priorityTabs.slice(0, maxVisible)
  const hiddenTabs = [...priorityTabs.slice(maxVisible), ...overflowTabs]
  const hasMore = hiddenTabs.length > 0

  const isActive = (section) => {
    if (section === 'workspace') return pathname === '/workspace'
    return pathname.startsWith(`/workspace/${section}`)
  }

  const moreActive = hiddenTabs.some(s => isActive(s))

  const tabClass = (active) =>
    `flex flex-col items-center justify-center gap-0.5 flex-1 h-full ${active ? 'text-labor-red' : 'text-gray-500'}`

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-stone-200 pb-safe">
      <nav className="flex items-center h-14" aria-label="Mobile navigation">
        {/* Home */}
        <Link href="/workspace" className={tabClass(isActive('workspace'))}>
          <Icon name="workspace" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>

        {/* Priority tabs */}
        {visibleTabs.map(section => (
          <Link
            key={section}
            href={`/workspace/${section}`}
            className={tabClass(isActive(section))}
          >
            <Icon name={section} />
            <span className="text-[10px] font-medium">{labels[section]}</span>
          </Link>
        ))}

        {/* More button */}
        {hasMore && (
          <button
            onClick={() => setShowMore(prev => !prev)}
            className={tabClass(moreActive || showMore)}
            aria-expanded={showMore}
            aria-label="More sections"
          >
            <Icon name="more" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        )}
      </nav>

      {/* More popup */}
      {showMore && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setShowMore(false)}
            aria-hidden="true"
          />
          <div className="absolute bottom-full left-0 right-0 z-40 bg-white border-t border-stone-200 shadow-lg px-6 py-4">
            <div className="grid grid-cols-4 gap-4">
              {hiddenTabs.map(section => (
                <Link
                  key={section}
                  href={`/workspace/${section}`}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg ${
                    isActive(section) ? 'text-labor-red bg-red-50' : 'text-gray-600'
                  }`}
                >
                  <Icon name={section} />
                  <span className="text-[10px] font-medium">{labels[section]}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
