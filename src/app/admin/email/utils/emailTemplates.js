/**
 * Email template utilities and constants
 */

export const LOGO_HEADER = `<p style="text-align: center; margin-bottom: 24px;"><img src="https://members.votelabor.org/logo-dark.png" alt="Labor Party" width="200" style="max-width: 200px; height: auto;" /></p>`

// Default signature if user hasn't set a custom one
export const DEFAULT_SIGNATURE = 'In solidarity,<br>Labor Party'

// Email templates use {$SIGNATURE} marker for signature placement
export const EMAIL_TEMPLATES = [
  {
    id: 'announcement',
    name: 'General Announcement',
    subject: '',
    content: `${LOGO_HEADER}<p>{$name},</p><p>[Your announcement here]</p><p>{$SIGNATURE}</p>`,
  },
  {
    id: 'event',
    name: 'Event Invitation',
    subject: "You're Invited: ",
    content: `${LOGO_HEADER}<p>{$name},</p><p>You're invited to join us for an upcoming event!</p><p><strong>Event:</strong> [Event Name]<br><strong>Date:</strong> [Date]<br><strong>Time:</strong> [Time]<br><strong>Location:</strong> [Location/Virtual Link]</p><p>[Additional details about the event]</p><p>We hope to see you there!</p><p>{$SIGNATURE}</p>`,
  },
  {
    id: 'action',
    name: 'Call to Action',
    subject: 'Action Needed: ',
    content: `${LOGO_HEADER}<p>{$name},</p><p>We need your help with an urgent action.</p><p><strong>What:</strong> [Describe the action]</p><p><strong>Why it matters:</strong> [Explain the importance]</p><p><strong>How you can help:</strong></p><ul><li>[Action item 1]</li><li>[Action item 2]</li><li>[Action item 3]</li></ul><p>Together, we can make a difference.</p><p>{$SIGNATURE}</p>`,
  },
  {
    id: 'blank',
    name: 'Blank Template',
    subject: '',
    content: `${LOGO_HEADER}<p>{$name},</p><p></p><p>{$SIGNATURE}</p>`,
  },
]

/**
 * Apply signature to email content
 * Replaces {$SIGNATURE} marker with actual signature
 * @param {string} content - Email content with {$SIGNATURE} marker
 * @param {string} signature - Signature to insert (or default if not provided)
 * @returns {string} Content with signature applied
 */
export function applySignature(content, signature) {
  const signatureToUse = signature || DEFAULT_SIGNATURE
  return content.replace(/\{\$SIGNATURE\}/g, signatureToUse)
}
