import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/resend'

/**
 * Fetch an email template from the database
 */
export async function getTemplate(templateKey) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('template_key', templateKey)
    .single()

  if (error) {
    console.error('Error fetching template:', error)
    return null
  }

  return data
}

/**
 * Get all email templates
 */
export async function getAllTemplates() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .order('name')

  if (error) {
    console.error('Error fetching templates:', error)
    return []
  }

  return data
}

/**
 * Replace template variables with actual values
 */
export function renderTemplate(template, variables) {
  let subject = template.subject
  let content = template.html_content

  // Replace all variables in both subject and content
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g')
    subject = subject.replace(regex, value || '')
    content = content.replace(regex, value || '')
  }

  return { subject, content }
}

/**
 * Wrap content in the standard email HTML template
 */
function wrapInEmailTemplate(content) {
  return `
<!DOCTYPE html>
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
    ul {
      padding-left: 20px;
    }
    li {
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="content">
    ${content}
  </div>
  <div class="footer">
    <p>Labor Party</p>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe">Unsubscribe</a></p>
  </div>
</body>
</html>
`
}

/**
 * Log an automated email send
 */
async function logEmailSend({ templateKey, recipientEmail, recipientType, recipientId, relatedId, subject, status, errorMessage }) {
  const supabase = createAdminClient()

  try {
    await supabase.from('automated_email_logs').insert({
      template_key: templateKey,
      recipient_email: recipientEmail,
      recipient_type: recipientType,
      recipient_id: recipientId,
      related_id: relatedId,
      subject,
      status,
      error_message: errorMessage,
    })
  } catch (err) {
    // Log error but don't fail the email send
    console.error('Failed to log email:', err)
  }
}

/**
 * Check if a reminder email has already been sent
 */
export async function hasReminderBeenSent(templateKey, recipientEmail, relatedId) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('automated_email_logs')
    .select('id')
    .eq('template_key', templateKey)
    .eq('recipient_email', recipientEmail)
    .eq('related_id', relatedId)
    .eq('status', 'sent')
    .limit(1)

  if (error) {
    console.error('Error checking reminder status:', error)
    return false
  }

  return data && data.length > 0
}

/**
 * Send an automated email using a template
 */
export async function sendAutomatedEmail({
  templateKey,
  to,
  variables,
  recipientType = null,
  recipientId = null,
  relatedId = null,
}) {
  try {
    // Fetch the template
    const template = await getTemplate(templateKey)

    if (!template) {
      console.error(`Template not found: ${templateKey}`)
      return { success: false, error: 'Template not found' }
    }

    // Check if template is enabled
    if (!template.enabled) {
      console.log(`Template disabled: ${templateKey}`)
      return { success: true, skipped: true, reason: 'Template disabled' }
    }

    // Render the template with variables
    const { subject, content } = renderTemplate(template, variables)

    // Wrap in email HTML template
    const htmlContent = wrapInEmailTemplate(content)

    // Send the email
    const result = await sendEmail({
      to,
      subject,
      htmlContent,
      fromName: 'Labor Party',
    })

    // Log the send
    await logEmailSend({
      templateKey,
      recipientEmail: to,
      recipientType,
      recipientId,
      relatedId,
      subject,
      status: 'sent',
    })

    return { success: true, id: result.id }
  } catch (error) {
    console.error(`Failed to send automated email (${templateKey}):`, error)

    // Log the failure
    await logEmailSend({
      templateKey,
      recipientEmail: to,
      recipientType,
      recipientId,
      relatedId,
      subject: `[Failed] ${templateKey}`,
      status: 'failed',
      errorMessage: error.message,
    })

    return { success: false, error: error.message }
  }
}

/**
 * Format a date for display in emails
 */
export function formatEmailDate(dateString) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Format a time for display in emails
 */
export function formatEmailTime(dateString) {
  const date = new Date(dateString)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Format currency for display in emails
 */
export function formatEmailCurrency(amount) {
  return (amount / 100).toFixed(2)
}
