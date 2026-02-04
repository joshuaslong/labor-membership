import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendTestEmail, isResendConfigured, wrapEmailTemplate } from '@/lib/resend'
import { isValidEmail } from '@/lib/validation'

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

  // Get current admin (user can have multiple admin records)
  const { data: adminRecords } = await supabase
    .from('admin_users')
    .select('id, role, chapter_id')
    .eq('user_id', user.id)

  if (!adminRecords || adminRecords.length === 0) {
    return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
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
