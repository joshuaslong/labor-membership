import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendCampaignToEmail } from '@/lib/mailerlite'

export async function POST(request) {
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
  const { subject, content, testEmail, replyTo } = body

  if (!subject || !content || !testEmail) {
    return NextResponse.json({ error: 'Subject, content, and test email are required' }, { status: 400 })
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(testEmail)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  try {
    // Wrap content in basic HTML template (same as production)
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
      padding-bottom: 20px;
      border-bottom: 2px solid #E25555;
      margin-bottom: 24px;
    }
    .header img {
      max-width: 150px;
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
    .test-banner {
      background-color: #FEF3C7;
      border: 2px solid #F59E0B;
      padding: 12px;
      margin-bottom: 20px;
      border-radius: 4px;
      text-align: center;
      color: #92400E;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="test-banner">
    ⚠️ TEST EMAIL - This is a preview of how your email will appear
  </div>
  <div class="header">
    <strong style="color: #E25555; font-size: 24px;">Labor Party</strong>
  </div>
  <div class="content">
    ${content}
  </div>
  <div class="footer">
    <p>Labor Party</p>
    <p><a href="#">Unsubscribe</a></p>
  </div>
</body>
</html>
`

    // Get admin's name for from field
    const { data: adminMember } = await supabase
      .from('members')
      .select('first_name, last_name')
      .eq('user_id', user.id)
      .single()

    const fromName = adminMember
      ? `${adminMember.first_name} ${adminMember.last_name} - Labor Party`
      : 'Labor Party'

    const result = await sendCampaignToEmail({
      email: testEmail,
      subject: `[TEST] ${subject}`,
      htmlContent,
      fromName,
      replyTo: replyTo || undefined,
    })

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to send test email' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${testEmail}`,
      campaignId: result.campaign?.id,
    })
  } catch (error) {
    console.error('Test email send error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send test email' }, { status: 500 })
  }
}
