/**
 * Email validation utilities
 */

/**
 * Validate a single email address
 * More comprehensive than the simple regex in test route
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false
  }

  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return false
  }

  // Additional checks
  const parts = email.split('@')
  if (parts.length !== 2) {
    return false
  }

  const [localPart, domain] = parts

  // Local part can't be empty or longer than 64 chars
  if (localPart.length === 0 || localPart.length > 64) {
    return false
  }

  // Domain can't be empty or longer than 255 chars
  if (domain.length === 0 || domain.length > 255) {
    return false
  }

  // Domain must have at least one dot
  if (!domain.includes('.')) {
    return false
  }

  // Domain parts can't be empty
  const domainParts = domain.split('.')
  if (domainParts.some(part => part.length === 0)) {
    return false
  }

  return true
}

/**
 * Validate and filter an array of recipients
 * @param {Array} recipients - Array of recipient objects with email property
 * @returns {object} { valid: Array, invalid: Array }
 */
export function validateRecipients(recipients) {
  const valid = []
  const invalid = []

  for (const recipient of recipients) {
    if (!recipient || !recipient.email) {
      invalid.push({ ...recipient, reason: 'Missing email address' })
      continue
    }

    if (!isValidEmail(recipient.email)) {
      invalid.push({ ...recipient, reason: 'Invalid email format' })
      continue
    }

    valid.push(recipient)
  }

  return { valid, invalid }
}
