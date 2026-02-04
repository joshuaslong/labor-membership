import { Resend } from 'resend'

// Lazy initialization to avoid build errors when RESEND_API_KEY is not available
let resend = null
function getResendClient() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY)
  }
  return resend
}

/**
 * Image alignment is now handled via inline styles directly in the editor
 * This function is kept for backwards compatibility but may be removed
 */
function transformImageAlignment(html) {
  // Inline styles are already applied by the editor, no transformation needed
  return html
}

// Use mail.votelabor.org subdomain (verified in Resend)
const FROM_DOMAIN = process.env.RESEND_FROM_EMAIL || 'noreply@mail.votelabor.org'
const FROM_EMAIL = `Labor Party <${FROM_DOMAIN}>`

/**
 * Wrap email content in standard HTML email template
 * @param {string} content - The email body content (HTML)
 * @param {object} options - Template options
 * @param {boolean} options.includeUnsubscribe - Whether to include unsubscribe link (default: true)
 * @returns {string} Complete HTML email
 */
export function wrapEmailTemplate(content, options = {}) {
  const { includeUnsubscribe = true } = options
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://members.votelabor.org'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #374151;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      padding-bottom: 20px;
      border-bottom: 2px solid #E25555;
      margin-bottom: 24px;
    }
    .content {
      padding: 0 0 24px;
    }
    .footer {
      border-top: 1px solid #e5e7eb;
      padding-top: 20px;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
    a {
      color: #E25555;
    }
  </style>
</head>
<body>
  <div class="content">
    ${content}
  </div>
  ${includeUnsubscribe ? `<div class="footer">
    <p>Labor Party</p>
    <p><a href="${appUrl}/unsubscribe">Unsubscribe</a></p>
  </div>` : ''}
</body>
</html>`
}

/**
 * Send an email to a single recipient
 */
export async function sendEmail({
  to,
  subject,
  htmlContent,
  fromName,
  replyTo,
}) {
  const from = fromName ? `${fromName} <${FROM_DOMAIN}>` : FROM_EMAIL

  // Transform data-align attributes to inline styles for email compatibility
  const transformedHtml = transformImageAlignment(htmlContent)

  const { data, error } = await getResendClient().emails.send({
    from,
    to,
    subject,
    html: transformedHtml,
    replyTo,
  })

  if (error) {
    console.error('Resend error:', error)
    throw new Error(error.message)
  }

  return { success: true, id: data?.id }
}

/**
 * Send an email to multiple recipients (batch)
 * Resend supports up to 100 emails per batch request
 */
export async function sendBatchEmails({
  recipients, // Array of { email, firstName, lastName }
  subject,
  htmlContent,
  fromName,
  replyTo,
}) {
  const from = fromName ? `${fromName} <${FROM_DOMAIN}>` : FROM_EMAIL

  // Process recipients in batches of 100
  const batchSize = 100
  const results = []

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize)

    const emails = batch.map(recipient => {
      // Replace {$name} with recipient's first name
      let personalizedContent = htmlContent.replace(
        /\{\$name\}/g,
        recipient.firstName || 'Member'
      )

      // Transform data-align attributes to inline styles for email compatibility
      personalizedContent = transformImageAlignment(personalizedContent)

      return {
        from,
        to: recipient.email,
        subject,
        html: personalizedContent,
        replyTo,
      }
    })

    const { data, error } = await getResendClient().batch.send(emails)

    if (error) {
      console.error('Resend batch error:', error)
      throw new Error(error.message)
    }

    // Resend batch API returns { data: [...] } object, not an array directly
    const batchResults = data?.data || []
    if (Array.isArray(batchResults)) {
      results.push(...batchResults)
    } else if (data) {
      // Fallback if response format changes
      results.push(data)
    }
  }

  return { success: true, count: recipients.length, results }
}

/**
 * Send a test email to a single address
 */
export async function sendTestEmail({
  to,
  subject,
  htmlContent,
  fromName,
  replyTo,
}) {
  // Add test banner to content
  const testContent = `
    <div style="background-color: #FEF3C7; border: 2px solid #F59E0B; padding: 12px; margin-bottom: 20px; border-radius: 4px; text-align: center; color: #92400E; font-weight: bold;">
      ⚠️ TEST EMAIL - This is a preview of how your email will appear
    </div>
    ${htmlContent}
  `

  return sendEmail({
    to,
    subject: `[TEST] ${subject}`,
    htmlContent: testContent,
    fromName,
    replyTo,
  })
}

/**
 * Check if Resend is configured
 */
export function isResendConfigured() {
  return !!process.env.RESEND_API_KEY
}
