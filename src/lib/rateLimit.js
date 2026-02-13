/**
 * Simple in-memory rate limiter
 * For production with multiple servers, consider Redis-backed solution
 */

const rateLimitStore = new Map()

/**
 * Rate limiter options
 * @typedef {Object} RateLimitOptions
 * @property {number} maxRequests - Maximum number of requests allowed
 * @property {number} windowMs - Time window in milliseconds
 * @property {string} message - Error message when rate limit exceeded
 */

/**
 * Check if request should be rate limited
 * @param {string} identifier - Unique identifier (user ID, email, IP, etc.)
 * @param {RateLimitOptions} options - Rate limit configuration
 * @returns {Object} { allowed: boolean, remaining: number, resetAt: Date }
 */
export function checkRateLimit(identifier, options = {}) {
  const {
    maxRequests = 10,
    windowMs = 60000, // 1 minute default
  } = options

  const now = Date.now()
  const key = `${identifier}`

  // Get or initialize rate limit data
  let rateLimitData = rateLimitStore.get(key)

  if (!rateLimitData || now > rateLimitData.resetAt) {
    // New window or expired window
    rateLimitData = {
      count: 0,
      resetAt: now + windowMs
    }
  }

  // Increment request count
  rateLimitData.count++
  rateLimitStore.set(key, rateLimitData)

  // Check if limit exceeded
  const allowed = rateLimitData.count <= maxRequests
  const remaining = Math.max(0, maxRequests - rateLimitData.count)
  const resetAt = new Date(rateLimitData.resetAt)

  return {
    allowed,
    remaining,
    resetAt,
    limit: maxRequests
  }
}

/**
 * Clean up expired entries (call periodically to prevent memory leaks)
 */
export function cleanupRateLimitStore() {
  const now = Date.now()
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetAt) {
      rateLimitStore.delete(key)
    }
  }
}

// Clean up every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000)
}

/**
 * Email-specific rate limits
 */
export const EMAIL_RATE_LIMITS = {
  // Per admin user
  SEND_EMAIL: {
    maxRequests: 10, // 10 emails per hour
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Email sending limit exceeded. Please wait before sending more emails.'
  },

  // Test emails - more lenient
  TEST_EMAIL: {
    maxRequests: 20, // 20 test emails per hour
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Test email limit exceeded. Please wait before sending more test emails.'
  }
}
