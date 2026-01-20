import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendTestEmail, isResendConfigured } from '@/lib/resend'

export async function POST(request) {
  // Check if Resend is configured
  if (!isResendConfigured()) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 500 })
  }

  // Verify admin access
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Get current admin
  const { data: currentAdmin } = await supabase
    .from('admin_users')
    .select('id, role, chapter_id')
    .eq('user_id', user.id)
    .single()

  if (!currentAdmin) {
    return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
  }

  const body = await request.json()
  const { subject, content, testEmail, replyTo, senderName } = body

  if (!subject || !content || !testEmail) {
    return NextResponse.json({ error: 'Subject, content, and test email are required' }, { status: 400 })
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(testEmail)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  try {
    // Wrap content in HTML email template (same as production)
    const htmlContent = `
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
    .header {
      text-align: center;
      padding: 24px 20px;
      margin-bottom: 24px;
      background-color: #1f2937;
      border-radius: 8px;
    }
    .header img {
      max-width: 240px;
      height: auto;
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
  <div class="header">
    <img src="${process.env.NEXT_PUBLIC_APP_URL || 'https://members.votelabor.org'}/logo.png" alt="Labor Party" />
  </div>
  <div class="content">
    ${content.replace(/\{\$name\}/g, 'Test User')}
  </div>
  <div class="footer">
    <p>Labor Party</p>
    <p><a href="#">Unsubscribe</a></p>
  </div>
</body>
</html>
`

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
