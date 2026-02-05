import Link from 'next/link'

export default function QuickActions({ primaryAction, actions = [] }) {
  return (
    <div className="bg-white border border-stone-200 rounded">
      <div className="px-4 py-3 border-b border-stone-200">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Actions</h2>
      </div>
      <div className="p-2">
        {primaryAction && (
          <Link
            href={primaryAction.href}
            className="flex items-center gap-2 px-3 py-2 rounded text-sm font-medium bg-labor-red text-white hover:bg-labor-red-600 transition-colors mb-2"
          >
            {primaryAction.icon && (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={primaryAction.icon} />
              </svg>
            )}
            {primaryAction.label}
          </Link>
        )}

        <div className="space-y-0.5">
          {actions.map((action, index) => (
            <Link
              key={index}
              href={action.href}
              className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
