import { RRule, rrulestr } from 'rrule'

/**
 * Day-of-week constants for RRule
 */
const RRULE_DAYS = {
  0: RRule.SU, 1: RRule.MO, 2: RRule.TU, 3: RRule.WE,
  4: RRule.TH, 5: RRule.FR, 6: RRule.SA,
}

const DAY_ABBREVS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Get day-of-week info from a date string (YYYY-MM-DD)
 * Returns { dayOfWeek: 'SU', dayIndex: 0, nth: 1, dayName: 'Sunday' }
 */
export function getDayOrdinal(dateStr) {
  const date = new Date(dateStr + 'T12:00:00')
  const dayIndex = date.getDay()
  const dayOfMonth = date.getDate()
  const nth = Math.ceil(dayOfMonth / 7)
  return {
    dayOfWeek: DAY_ABBREVS[dayIndex],
    dayIndex,
    nth,
    dayName: DAY_NAMES[dayIndex],
  }
}

/**
 * Ordinal labels for display
 */
const ORDINAL_LABELS = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' }

/**
 * Recurrence presets with dynamic labels based on start_date
 */
export function getRecurrencePresets(startDate) {
  if (!startDate) {
    return [
      { key: 'weekly', label: 'Weekly' },
      { key: 'biweekly', label: 'Every 2 weeks' },
      { key: 'monthly_same_week', label: 'Monthly (same weekday)' },
      { key: 'monthly_last', label: 'Monthly (last weekday)' },
      { key: 'bimonthly', label: 'Every 2 months' },
      { key: 'custom', label: 'Custom' },
    ]
  }

  const { dayName, nth } = getDayOrdinal(startDate)
  const ordinal = ORDINAL_LABELS[nth] || `${nth}th`

  return [
    { key: 'weekly', label: `Weekly on ${dayName}` },
    { key: 'biweekly', label: `Every 2 weeks on ${dayName}` },
    { key: 'monthly_same_week', label: `Monthly on the ${ordinal} ${dayName}` },
    { key: 'monthly_last', label: `Monthly on the last ${dayName}` },
    { key: 'bimonthly', label: `Every 2 months on the ${ordinal} ${dayName}` },
    { key: 'custom', label: 'Custom' },
  ]
}

/**
 * Build an RRULE string from a preset key, start date, and optional end options.
 *
 * @param {string} preset - Preset key or 'custom'
 * @param {string} startDate - YYYY-MM-DD
 * @param {object} options - { endType: 'never'|'date'|'count', endDate, count, customFreq, customInterval, customByDay }
 * @returns {string} RRULE string (without DTSTART)
 */
export function buildRruleString(preset, startDate, options = {}) {
  const { dayOfWeek, nth, dayIndex } = getDayOrdinal(startDate)

  let parts = []

  switch (preset) {
    case 'weekly':
      parts.push('FREQ=WEEKLY', `BYDAY=${dayOfWeek}`)
      break
    case 'biweekly':
      parts.push('FREQ=WEEKLY', 'INTERVAL=2', `BYDAY=${dayOfWeek}`)
      break
    case 'monthly_same_week':
      parts.push('FREQ=MONTHLY', `BYDAY=${nth}${dayOfWeek}`)
      break
    case 'monthly_last':
      parts.push('FREQ=MONTHLY', `BYDAY=-1${dayOfWeek}`)
      break
    case 'bimonthly':
      parts.push('FREQ=MONTHLY', 'INTERVAL=2', `BYDAY=${nth}${dayOfWeek}`)
      break
    case 'custom': {
      const freq = (options.customFreq || 'WEEKLY').toUpperCase()
      parts.push(`FREQ=${freq}`)
      if (options.customInterval && options.customInterval > 1) {
        parts.push(`INTERVAL=${options.customInterval}`)
      }
      if (options.customByDay && options.customByDay.length > 0) {
        parts.push(`BYDAY=${options.customByDay.join(',')}`)
      } else if (freq === 'WEEKLY') {
        parts.push(`BYDAY=${dayOfWeek}`)
      } else if (freq === 'MONTHLY' && options.customMonthlyPosition) {
        parts.push(`BYDAY=${options.customMonthlyPosition}`)
      }
      break
    }
    default:
      return null
  }

  // End condition
  if (options.endType === 'date' && options.endDate) {
    const d = options.endDate.replace(/-/g, '')
    parts.push(`UNTIL=${d}T235959Z`)
  } else if (options.endType === 'count' && options.count) {
    parts.push(`COUNT=${options.count}`)
  }
  // 'never' = no UNTIL or COUNT (application enforces 1 year max)

  return parts.join(';')
}

/**
 * Parse a date string to a Date for rrule (noon UTC to avoid DST issues)
 */
function parseDtstart(dateStr) {
  return new Date(dateStr + 'T12:00:00Z')
}

/**
 * Get occurrences of an RRULE within a date range.
 *
 * @param {string} rruleString - RRULE string
 * @param {string} dtstart - YYYY-MM-DD start date
 * @param {Date|string} rangeStart
 * @param {Date|string} rangeEnd
 * @returns {string[]} Array of YYYY-MM-DD date strings
 */
export function getOccurrences(rruleString, dtstart, rangeStart, rangeEnd) {
  const start = typeof rangeStart === 'string' ? new Date(rangeStart + 'T00:00:00Z') : rangeStart
  const end = typeof rangeEnd === 'string' ? new Date(rangeEnd + 'T23:59:59Z') : rangeEnd

  const rule = rrulestr(`DTSTART:${dtstart.replace(/-/g, '')}T120000Z\nRRULE:${rruleString}`)
  const dates = rule.between(start, end, true)

  return dates.map(d => {
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
}

/**
 * Get the next occurrence after a given date.
 */
export function getNextOccurrence(rruleString, dtstart, afterDate) {
  const after = typeof afterDate === 'string' ? new Date(afterDate + 'T00:00:00Z') : afterDate
  const rule = rrulestr(`DTSTART:${dtstart.replace(/-/g, '')}T120000Z\nRRULE:${rruleString}`)
  const next = rule.after(after, false)
  if (!next) return null
  const year = next.getUTCFullYear()
  const month = String(next.getUTCMonth() + 1).padStart(2, '0')
  const day = String(next.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Expand a recurring event into individual instances for a date range.
 * Non-recurring events return a single instance.
 *
 * @param {object} event - Parent event row
 * @param {object[]} overrides - Array of event_instance_overrides rows
 * @param {string} rangeStart - YYYY-MM-DD
 * @param {string} rangeEnd - YYYY-MM-DD
 * @returns {object[]} Array of instance objects
 */
export function expandEventInstances(event, overrides, rangeStart, rangeEnd) {
  if (!event.rrule) {
    // Non-recurring: return as single instance
    return [{
      ...event,
      instance_date: event.start_date,
      is_recurring: false,
      is_cancelled: event.status === 'cancelled',
    }]
  }

  const dates = getOccurrences(event.rrule, event.start_date, rangeStart, rangeEnd)

  // Build override map keyed by instance_date
  const overrideMap = {}
  for (const o of (overrides || [])) {
    overrideMap[o.instance_date] = o
  }

  return dates.map(dateStr => {
    const override = overrideMap[dateStr]

    if (override?.is_cancelled) {
      return null // Filter out cancelled instances
    }

    return {
      ...event,
      instance_date: dateStr,
      is_recurring: true,
      is_cancelled: false,
      // Override fields take precedence
      title: override?.title ?? event.title,
      description: override?.description ?? event.description,
      location_name: override?.location_name ?? event.location_name,
      location_address: override?.location_address ?? event.location_address,
      location_city: override?.location_city ?? event.location_city,
      location_state: override?.location_state ?? event.location_state,
      location_zip: override?.location_zip ?? event.location_zip,
      is_virtual: override?.is_virtual ?? event.is_virtual,
      virtual_link: override?.virtual_link ?? event.virtual_link,
      start_time: override?.start_time ?? event.start_time,
      end_time: override?.end_time ?? event.end_time,
      max_attendees: override?.max_attendees ?? event.max_attendees,
      rsvp_deadline: override?.rsvp_deadline ?? event.rsvp_deadline,
    }
  }).filter(Boolean)
}

/**
 * Get a human-readable description of an RRULE.
 */
export function describeRrule(rruleString, startDate) {
  if (!rruleString) return ''
  try {
    const rule = rrulestr(`DTSTART:${startDate.replace(/-/g, '')}T120000Z\nRRULE:${rruleString}`)
    // Capitalize first letter
    const text = rule.toText()
    return text.charAt(0).toUpperCase() + text.slice(1)
  } catch {
    return 'Custom recurrence'
  }
}

/**
 * Compute the effective end date from an RRULE.
 * If UNTIL is specified, returns it. If COUNT, calculates last occurrence.
 * If neither, returns startDate + 1 year.
 */
export function computeRecurrenceEndDate(rruleString, startDate) {
  if (!rruleString) return null

  try {
    const rule = rrulestr(`DTSTART:${startDate.replace(/-/g, '')}T120000Z\nRRULE:${rruleString}`)
    const opts = rule.options

    // If UNTIL is set, extract it
    if (opts.until) {
      const d = opts.until
      const year = d.getUTCFullYear()
      const month = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // If COUNT is set, compute last occurrence
    if (opts.count) {
      const all = rule.all()
      if (all.length > 0) {
        const last = all[all.length - 1]
        const year = last.getUTCFullYear()
        const month = String(last.getUTCMonth() + 1).padStart(2, '0')
        const day = String(last.getUTCDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
    }

    // No end specified: default to start_date + 1 year
    const d = new Date(startDate + 'T12:00:00Z')
    d.setUTCFullYear(d.getUTCFullYear() + 1)
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  } catch {
    // Fallback: start_date + 1 year
    const d = new Date(startDate + 'T12:00:00Z')
    d.setUTCFullYear(d.getUTCFullYear() + 1)
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}

/**
 * Detect which preset an RRULE string matches, if any.
 * Returns the preset key or 'custom'.
 */
export function detectPreset(rruleString, startDate) {
  if (!rruleString) return null

  const { dayOfWeek, nth } = getDayOrdinal(startDate)
  const upper = rruleString.toUpperCase()

  // Remove UNTIL/COUNT for matching
  const core = upper.replace(/;?(UNTIL|COUNT)=[^;]*/g, '').replace(/^;|;$/g, '')

  if (core === `FREQ=WEEKLY;BYDAY=${dayOfWeek}`) return 'weekly'
  if (core === `FREQ=WEEKLY;INTERVAL=2;BYDAY=${dayOfWeek}`) return 'biweekly'
  if (core === `FREQ=MONTHLY;BYDAY=${nth}${dayOfWeek}`) return 'monthly_same_week'
  if (core === `FREQ=MONTHLY;BYDAY=-1${dayOfWeek}`) return 'monthly_last'
  if (core === `FREQ=MONTHLY;INTERVAL=2;BYDAY=${nth}${dayOfWeek}`) return 'bimonthly'

  return 'custom'
}

/**
 * Parse end condition from an RRULE string.
 * Returns { endType: 'never'|'date'|'count', endDate?, count? }
 */
export function parseEndCondition(rruleString) {
  if (!rruleString) return { endType: 'never' }

  const untilMatch = rruleString.match(/UNTIL=(\d{4})(\d{2})(\d{2})/)
  if (untilMatch) {
    return {
      endType: 'date',
      endDate: `${untilMatch[1]}-${untilMatch[2]}-${untilMatch[3]}`,
    }
  }

  const countMatch = rruleString.match(/COUNT=(\d+)/)
  if (countMatch) {
    return {
      endType: 'count',
      count: parseInt(countMatch[1]),
    }
  }

  return { endType: 'never' }
}
