import Link from 'next/link'
import PropTypes from 'prop-types'

/**
 * QuickActions component displays a list of action links with an optional primary action.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Object} [props.primaryAction] - Primary action with icon, label, and href
 * @param {Array} [props.actions=[]] - Array of secondary actions with label and href
 *
 * @security
 * - Icon paths (primaryAction.icon) should contain trusted SVG path data from a controlled
 *   source (e.g., icon library), NOT user-generated content, to prevent SVG injection attacks.
 * - All href values should be validated by the caller to ensure they are safe URLs and do not
 *   use dangerous protocols like `javascript:`. Consider using Next.js Link component's
 *   built-in protections and validating URLs before passing them to this component.
 */
function QuickActions({ primaryAction, actions = [] }) {
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
            aria-label={primaryAction.ariaLabel || primaryAction.label}
          >
            {primaryAction.icon && (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                {/* WARNING: icon prop should only contain trusted SVG path data from a controlled source */}
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={primaryAction.icon} />
              </svg>
            )}
            {primaryAction.label}
          </Link>
        )}

        <div className="space-y-0.5">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded"
              aria-label={action.ariaLabel || action.label}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

QuickActions.displayName = 'QuickActions'

QuickActions.propTypes = {
  primaryAction: PropTypes.shape({
    icon: PropTypes.string,
    label: PropTypes.string.isRequired,
    href: PropTypes.string.isRequired,
    ariaLabel: PropTypes.string
  }),
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      href: PropTypes.string.isRequired,
      ariaLabel: PropTypes.string
    })
  )
}

export default QuickActions
