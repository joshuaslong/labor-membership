import PropTypes from 'prop-types'
import { getSegmentColor, getSegmentLabel } from '@/lib/segments'

/**
 * Badge component displaying a member's segment with appropriate styling.
 *
 * XSS Safety:
 * - Segment values are constrained by database CHECK constraints to only valid values:
 *   'donor', 'volunteer', 'event_attendee', 'organizer', 'new_member'
 * - React automatically escapes text content when rendering, preventing XSS attacks
 * - Component gracefully handles null/undefined by returning null (defensive coding)
 */
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
  segment: PropTypes.string
}
