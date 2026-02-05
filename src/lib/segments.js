/**
 * Segment utilities and constants
 */

export const SEGMENTS = {
  DONOR: 'donor',
  VOLUNTEER: 'volunteer',
  EVENT_ATTENDEE: 'event_attendee',
  ORGANIZER: 'organizer',
  NEW_MEMBER: 'new_member'
}

export const SEGMENT_LABELS = {
  [SEGMENTS.DONOR]: 'Donor',
  [SEGMENTS.VOLUNTEER]: 'Volunteer',
  [SEGMENTS.EVENT_ATTENDEE]: 'Event Attendee',
  [SEGMENTS.ORGANIZER]: 'Organizer',
  [SEGMENTS.NEW_MEMBER]: 'New Member'
}

export const SEGMENT_COLORS = {
  [SEGMENTS.DONOR]: 'text-green-700 bg-green-50 border-green-200',
  [SEGMENTS.VOLUNTEER]: 'text-labor-red bg-red-50 border-red-200',
  [SEGMENTS.EVENT_ATTENDEE]: 'text-amber-700 bg-amber-50 border-amber-200',
  [SEGMENTS.ORGANIZER]: 'text-gray-900 bg-stone-100 border-stone-300',
  [SEGMENTS.NEW_MEMBER]: 'text-blue-700 bg-blue-50 border-blue-200'
}

/**
 * Get segment color classes
 */
export function getSegmentColor(segment) {
  return SEGMENT_COLORS[segment] || 'text-gray-700 bg-stone-50 border-stone-200'
}

/**
 * Get segment label
 */
export function getSegmentLabel(segment) {
  return SEGMENT_LABELS[segment] || segment
}

/**
 * Check if segment is auto-applied (cannot be manually removed)
 */
export function isAutoAppliedSegment(segment, autoApplied) {
  return segment === SEGMENTS.NEW_MEMBER && autoApplied
}
