'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import PropTypes from 'prop-types'

/**
 * ContextualSidebar component displays a navigation sidebar with headers, dividers, and links.
 * Automatically highlights the active link based on the current pathname.
 *
 * @component
 * @param {Object} props
 * @param {Array<Object>} props.items - Array of navigation items
 * @param {string} props.items[].type - Type of item: 'header', 'divider', or 'link'
 * @param {string} [props.items[].label] - Label text for header or link items
 * @param {string} [props.items[].href] - URL path for link items
 *
 * @example
 * <ContextualSidebar items={[
 *   { type: 'header', label: 'Settings' },
 *   { type: 'link', label: 'Profile', href: '/settings/profile' },
 *   { type: 'divider' },
 *   { type: 'link', label: 'Security', href: '/settings/security' }
 * ]} />
 */
function ContextualSidebar({ items = [] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Defensive validation: ensure items is an array
  if (!Array.isArray(items)) {
    return null
  }

  // Build current full path including query params for comparison
  const currentSearch = searchParams.toString()
  const currentPath = currentSearch ? `${pathname}?${currentSearch}` : pathname

  const isActive = (href) => currentPath === href

  return (
    <nav className="w-60 bg-white border-r border-stone-200 sticky top-[61px] h-[calc(100vh-61px)] overflow-y-auto flex-shrink-0" aria-label="Section navigation">
      <div className="p-4 space-y-1">
        {items.map((item, index) => {
          // Defensive validation: ensure item exists
          if (!item || typeof item !== 'object') {
            return null
          }

          // Generate stable key: prefer href or label over index
          const key = item.href || item.label || `item-${index}`

          if (item.type === 'header') {
            return (
              <div
                key={key}
                className="text-xs uppercase tracking-wide text-gray-500 font-medium px-3 py-2 mt-4 first:mt-0"
                role="heading"
                aria-level="2"
              >
                {item.label}
              </div>
            )
          }

          if (item.type === 'divider') {
            return <div key={`divider-${index}`} className="border-t border-stone-200 my-2" role="separator" />
          }

          // Validate href exists before rendering Link
          if (!item.href) {
            return null
          }

          const isLinkActive = isActive(item.href)
          const isPrimary = item.variant === 'primary'

          return (
            <Link
              key={key}
              href={item.href}
              className={`block px-3 py-1.5 text-sm rounded ${
                isPrimary
                  ? 'bg-labor-red text-white font-medium hover:bg-labor-red/90'
                  : isLinkActive
                    ? 'bg-stone-100 text-gray-900 font-medium'
                    : 'text-gray-700 hover:bg-stone-50'
              }`}
              aria-current={isLinkActive ? 'page' : undefined}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

ContextualSidebar.displayName = 'ContextualSidebar'

ContextualSidebar.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      type: PropTypes.oneOf(['header', 'divider', 'link']).isRequired,
      label: PropTypes.string,
      href: PropTypes.string,
      variant: PropTypes.oneOf(['primary'])
    })
  )
}

export default ContextualSidebar
