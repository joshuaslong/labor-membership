import PropTypes from 'prop-types'

/**
 * StatCard component displays a statistic with a label, value, and optional subtext.
 *
 * @component
 * @param {Object} props
 * @param {string|number|React.ReactNode} props.label - The label text for the statistic
 * @param {string|number|React.ReactNode} props.value - The main value to display
 * @param {string|number|React.ReactNode} [props.subtext] - Optional subtext below the value
 * @param {string} [props.valueColor='text-gray-900'] - Tailwind color class for the value (must be from whitelist)
 *
 * @note XSS Safety: React automatically escapes text content, preventing XSS attacks.
 * The valueColor prop uses a whitelist to prevent arbitrary class injection.
 */
function StatCard({ label, value, subtext, valueColor = 'text-gray-900' }) {
  // Defensive validation: ensure required props are provided
  if (label == null || value == null) {
    return null
  }

  // Whitelist of allowed Tailwind color classes to prevent arbitrary class injection
  const allowedColors = new Set([
    'text-gray-900',
    'text-gray-800',
    'text-gray-700',
    'text-gray-600',
    'text-blue-600',
    'text-blue-700',
    'text-green-600',
    'text-green-700',
    'text-red-600',
    'text-red-700',
    'text-yellow-600',
    'text-yellow-700',
    'text-purple-600',
    'text-purple-700',
    'text-indigo-600',
    'text-indigo-700'
  ])

  // Use whitelisted color or fallback to default
  const safeValueColor = allowedColors.has(valueColor) ? valueColor : 'text-gray-900'

  return (
    <div className="bg-white border border-stone-200 rounded p-4" role="region" aria-label={`Statistic: ${label}`}>
      <div className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-1" id="stat-label">
        {label}
      </div>
      <div className={`text-2xl font-semibold ${safeValueColor} tabular-nums`} aria-describedby="stat-label">
        {value}
      </div>
      {subtext && (
        <div className="text-xs text-gray-600 mt-0.5">
          {subtext}
        </div>
      )}
    </div>
  )
}

StatCard.displayName = 'StatCard'

StatCard.propTypes = {
  label: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.node
  ]).isRequired,
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.node
  ]).isRequired,
  subtext: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
    PropTypes.node
  ]),
  valueColor: PropTypes.string
}

export default StatCard
