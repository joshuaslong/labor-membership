import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendBatchEmails, isResendConfigured } from '@/lib/resend'

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

  // Get current admin's role and chapter
  const { data: currentAdmin } = await supabase
    .from('admin_users')
    .select('id, role, chapter_id, chapters(name)')
    .eq('user_id', user.id)
    .single()

  if (!currentAdmin) {
    return NextResponse.json({ error: 'Not an admin' }, { status: 403 })
  }

  const body = await request.json()
  const { subject, content, recipientType, chapterId, replyTo, senderName } = body

  if (!subject || !content) {
    return NextResponse.json({ error: 'Subject and content are required' }, { status: 400 })
  }

  const isSuperAdmin = ['super_admin', 'national_admin'].includes(currentAdmin.role)

  try {
    // Get recipients from Supabase based on selection
    let recipients = []

    if (recipientType === 'all_members' && isSuperAdmin) {
      // Get all active members
      const { data: members, error } = await supabase
        .from('members')
        .select('email, first_name, last_name')
        .eq('status', 'active')

      if (error) throw new Error('Failed to fetch members')
      recipients = members || []

    } else if (recipientType === 'chapter') {
      // Verify admin has access to this chapter
      if (!isSuperAdmin) {
        const { data: descendants } = await supabase
          .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })
        const allowedChapterIds = descendants?.map(d => d.id) || []

        if (!allowedChapterIds.includes(chapterId) && currentAdmin.chapter_id !== chapterId) {
          return NextResponse.json({ error: 'You do not have access to this chapter' }, { status: 403 })
        }
      }

      // Get all chapter IDs including descendants
      const { data: allChapterIds } = await supabase
        .rpc('get_chapter_descendants', { chapter_uuid: chapterId })
      const chapterIds = allChapterIds?.map(c => c.id) || [chapterId]

      // Get members in these chapters
      const { data: members, error } = await supabase
        .from('members')
        .select('email, first_name, last_name')
        .in('chapter_id', chapterIds)
        .eq('status', 'active')

      if (error) throw new Error('Failed to fetch chapter members')
      recipients = members || []

    } else if (recipientType === 'my_chapter') {
      // Get admin's chapter and descendants
      const { data: allChapterIds } = await supabase
        .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })
      const chapterIds = allChapterIds?.map(c => c.id) || [currentAdmin.chapter_id]

      const { data: members, error } = await supabase
        .from('members')
        .select('email, first_name, last_name')
        .in('chapter_id', chapterIds)
        .eq('status', 'active')

      if (error) throw new Error('Failed to fetch chapter members')
      recipients = members || []

    } else if (recipientType === 'mailing_list' && isSuperAdmin) {
      // Get mailing list subscribers (non-members)
      const { data: subscribers, error } = await supabase
        .from('mailing_list')
        .select('email, first_name, last_name')
        .eq('subscribed', true)

      if (error) throw new Error('Failed to fetch mailing list')
      recipients = subscribers || []
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients found for the selected criteria' }, { status: 400 })
    }

    // Wrap content in HTML email template
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
    ${content}
  </div>
  <div class="footer">
    <p>Labor Party</p>
    <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe">Unsubscribe</a></p>
  </div>
</body>
</html>
`

    // Use provided sender name or default to "Labor Party"
    const fromName = senderName || 'Labor Party'

    // Format recipients for Resend
    const formattedRecipients = recipients.map(r => ({
      email: r.email,
      firstName: r.first_name,
      lastName: r.last_name,
    }))

    // Send emails via Resend
    const result = await sendBatchEmails({
      recipients: formattedRecipients,
      subject,
      htmlContent,
      fromName,
      replyTo: replyTo || undefined,
    })

    // Log the email send
    await supabase.from('email_logs').insert({
      admin_id: currentAdmin.id,
      subject,
      recipient_type: recipientType,
      chapter_id: chapterId || currentAdmin.chapter_id,
      status: 'sent',
      recipient_count: recipients.length,
    }).catch(() => {
      // Table might not exist yet, that's ok
    })

    return NextResponse.json({
      success: true,
      message: `Email sent to ${recipients.length} recipient${recipients.length !== 1 ? 's' : ''}`,
      count: recipients.length,
    })
  } catch (error) {
    console.error('Email send error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 })
  }
}
