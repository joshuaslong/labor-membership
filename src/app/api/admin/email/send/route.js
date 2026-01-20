import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendCampaignToGroups, getOrCreateChapterGroup, getOrCreateGroup } from '@/lib/mailerlite'

export async function POST(request) {
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
  const { subject, content, recipientType, chapterId, replyTo } = body

  if (!subject || !content) {
    return NextResponse.json({ error: 'Subject and content are required' }, { status: 400 })
  }

  // Determine which groups to send to based on admin's permissions
  const groupIds = []
  const isSuperAdmin = ['super_admin', 'national_admin'].includes(currentAdmin.role)

  try {
    if (recipientType === 'all_members' && isSuperAdmin) {
      // Send to all members
      const allMembersGroupId = await getOrCreateGroup('All Members')
      if (allMembersGroupId) groupIds.push(allMembersGroupId)
    } else if (recipientType === 'chapter') {
      // Send to specific chapter
      // Verify admin has access to this chapter
      if (!isSuperAdmin) {
        // Get allowed chapters
        const { data: descendants } = await supabase
          .rpc('get_chapter_descendants', { chapter_uuid: currentAdmin.chapter_id })
        const allowedChapterIds = descendants?.map(d => d.id) || []

        if (!allowedChapterIds.includes(chapterId) && currentAdmin.chapter_id !== chapterId) {
          return NextResponse.json({ error: 'You do not have access to this chapter' }, { status: 403 })
        }
      }

      // Get chapter name
      const { data: chapter } = await supabase
        .from('chapters')
        .select('name')
        .eq('id', chapterId)
        .single()

      if (chapter) {
        const chapterGroupId = await getOrCreateChapterGroup(chapter.name)
        if (chapterGroupId) groupIds.push(chapterGroupId)
      }
    } else if (recipientType === 'my_chapter') {
      // Send to admin's own chapter
      if (currentAdmin.chapters?.name) {
        const chapterGroupId = await getOrCreateChapterGroup(currentAdmin.chapters.name)
        if (chapterGroupId) groupIds.push(chapterGroupId)
      }
    } else if (recipientType === 'mailing_list') {
      // Send to mailing list only (non-members who signed up)
      const mailingListGroupId = await getOrCreateGroup('Mailing List')
      if (mailingListGroupId) groupIds.push(mailingListGroupId)
    }

    if (groupIds.length === 0) {
      return NextResponse.json({ error: 'No recipients found for the selected criteria' }, { status: 400 })
    }

    // Wrap content in basic HTML template
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
  </style>
</head>
<body>
  <div class="header">
    <strong style="color: #E25555; font-size: 24px;">Labor Party</strong>
  </div>
  <div class="content">
    ${content}
  </div>
  <div class="footer">
    <p>Labor Party</p>
    <p><a href="{$unsubscribe}">Unsubscribe</a></p>
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

    const result = await sendCampaignToGroups({
      groupIds,
      subject,
      htmlContent,
      fromName,
      replyTo: replyTo || undefined,
    })

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    // Log the email send
    await supabase.from('email_logs').insert({
      admin_id: currentAdmin.id,
      subject,
      recipient_type: recipientType,
      chapter_id: chapterId || currentAdmin.chapter_id,
      status: 'sent',
      mailerlite_campaign_id: result.campaign?.id,
    }).catch(() => {
      // Table might not exist yet, that's ok
    })

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      campaignId: result.campaign?.id,
    })
  } catch (error) {
    console.error('Email send error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 })
  }
}
