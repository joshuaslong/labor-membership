import PropTypes from 'prop-types'
import { getSegmentColor, getSegmentLabel } from '@/lib/segments'

export default function SegmentBadge({ segment }) {
  // Validate segment prop - return null if not provided
  if (!segment || typeof segment !== 'string') {
    return null
  }

  const colorClasses = getSegmentColor(segment)
  const label = getSegmentLabel(segment)

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClasses}`}
      role="status"
      aria-label={`Segment: ${label}`}
    >
      {label}
    </span>
  )
}

SegmentBadge.displayName = 'SegmentBadge'

SegmentBadge.propTypes = {
  segment: PropTypes.string.isRequired
}
