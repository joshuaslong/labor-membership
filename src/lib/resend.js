import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

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

  const { data, error } = await resend.emails.send({
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

    const { data, error } = await resend.batch.send(emails)

    if (error) {
      console.error('Resend batch error:', error)
      throw new Error(error.message)
    }

    results.push(...(data || []))
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
