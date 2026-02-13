import { NextResponse } from 'next/server'
import { sendTestEmail, isResendConfigured, wrapEmailTemplate } from '@/lib/resend'
import { isValidEmail } from '@/lib/validation'
import { checkRateLimit, EMAIL_RATE_LIMITS } from '@/lib/rateLimit'
import { requireAdmin } from '@/lib/adminAuth'

export async function POST(request) {
  // Check if Resend is configured
  if (!isResendConfigured()) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 500 })
  }

  // Authenticate admin
  const { admin, error: authError } = await requireAdmin()
  if (authError) return authError

  // Check rate limit
  const rateLimitConfig = EMAIL_RATE_LIMITS.TEST_EMAIL
  const rateLimit = checkRateLimit(admin.userId, rateLimitConfig)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: rateLimitConfig.message,
        resetAt: rateLimit.resetAt.toISOString()
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateLimit.limit),
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': rateLimit.resetAt.toISOString()
        }
      }
    )
  }

  const body = await request.json()
  const { subject, content, testEmail, replyTo, senderName } = body

  if (!subject || !content || !testEmail) {
    return NextResponse.json({ error: 'Subject, content, and test email are required' }, { status: 400 })
  }

  // Validate email format
  if (!isValidEmail(testEmail)) {
    return NextResponse.json({ error: 'Invalid email address format' }, { status: 400 })
  }

  try {
    // Replace personalization variables for test
    const testContent = content.replace(/\{\$name\}/g, 'Test User')

    // Wrap content in HTML email template (same as production)
    const htmlContent = wrapEmailTemplate(testContent, { includeUnsubscribe: false })

    // Use provided sender name or default to "Labor Party"
    const fromName = senderName || 'Labor Party'

    const result = await sendTestEmail({
      to: testEmail,
      subject,
      htmlContent,
      fromName,
      replyTo: replyTo || undefined,
    })

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${testEmail}`,
      id: result.id,
    })
  } catch (error) {
    console.error('Test email send error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send test email' }, { status: 500 })
  }
}
