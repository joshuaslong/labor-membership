'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function ContextualSidebar({ items = [] }) {
  const pathname = usePathname()

  const isActive = (href) => pathname === href

  return (
    <div className="w-60 bg-white border-r border-stone-200 min-h-screen">
      <div className="p-4 space-y-1">
        {items.map((item, index) => {
          if (item.type === 'header') {
            return (
              <div key={index} className="text-xs uppercase tracking-wide text-gray-500 font-medium px-3 py-2 mt-4 first:mt-0">
                {item.label}
              </div>
            )
          }

          if (item.type === 'divider') {
            return <div key={index} className="border-t border-stone-200 my-2" />
          }

          return (
            <Link
              key={index}
              href={item.href}
              className={`block px-3 py-1.5 text-sm rounded ${
                isActive(item.href)
                  ? 'bg-stone-100 text-gray-900 font-medium'
                  : 'text-gray-700 hover:bg-stone-50'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
