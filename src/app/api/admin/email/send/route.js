import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendBatchEmails, isResendConfigured, wrapEmailTemplate } from '@/lib/resend'
import { validateRecipients } from '@/lib/validation'
import { checkRateLimit, EMAIL_RATE_LIMITS } from '@/lib/rateLimit'
import { requireAdmin, isSuperAdmin } from '@/lib/adminAuth'

export async function POST(request) {
  // Check if Resend is configured
  if (!isResendConfigured()) {
    return NextResponse.json({ error: 'RESEND_API_KEY is not configured' }, { status: 500 })
  }

  // Authenticate admin
  const { admin, error: authError } = await requireAdmin({ includeChapter: true })
  if (authError) return authError

  // Check rate limit
  const rateLimitConfig = EMAIL_RATE_LIMITS.SEND_EMAIL
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
  const { subject, content, recipientType, chapterId, groupId, replyTo, senderName } = body

  if (!subject || !content) {
    return NextResponse.json({ error: 'Subject and content are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const isSuper = isSuperAdmin(admin.role)

  try {
    // Get recipients from Supabase based on selection
    let recipients = []

    if (recipientType === 'all_members' && isSuper) {
      // Get all active members
      const { data: members, error } = await supabase
        .from('members')
        .select('email, first_name, last_name')
        .eq('status', 'active')

      if (error) throw new Error('Failed to fetch members')
      recipients = members || []

    } else if (recipientType === 'chapter') {
      // Verify admin has access to this chapter
      if (!isSuper) {
        const { data: descendants } = await supabase
          .rpc('get_chapter_descendants', { chapter_uuid: admin.chapterId })
        const allowedChapterIds = descendants?.map(d => d.id) || []

        if (!allowedChapterIds.includes(chapterId) && admin.chapterId !== chapterId) {
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
        .rpc('get_chapter_descendants', { chapter_uuid: admin.chapterId })
      const chapterIds = allChapterIds?.map(c => c.id) || [admin.chapterId]

      const { data: members, error } = await supabase
        .from('members')
        .select('email, first_name, last_name')
        .in('chapter_id', chapterIds)
        .eq('status', 'active')

      if (error) throw new Error('Failed to fetch chapter members')
      recipients = members || []

    } else if (recipientType === 'group') {
      // Send to a specific chapter group
      if (!groupId) {
        return NextResponse.json({ error: 'Group ID is required' }, { status: 400 })
      }

      // Get the group and verify jurisdiction
      const { data: group, error: groupError } = await supabase
        .from('chapter_groups')
        .select('id, chapter_id, name')
        .eq('id', groupId)
        .single()

      if (groupError || !group) {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 })
      }

      if (!isSuper) {
        const { data: descendants } = await supabase
          .rpc('get_chapter_descendants', { chapter_uuid: admin.chapterId })
        const allowedChapterIds = descendants?.map(d => d.id) || []

        if (!allowedChapterIds.includes(group.chapter_id) && admin.chapterId !== group.chapter_id) {
          return NextResponse.json({ error: 'You do not have access to this group' }, { status: 403 })
        }
      }

      // Get members in this group
      const { data: assignments, error: assignError } = await supabase
        .from('member_group_assignments')
        .select('members(email, first_name, last_name)')
        .eq('group_id', groupId)

      if (assignError) throw new Error('Failed to fetch group members')

      recipients = (assignments || [])
        .map(a => a.members)
        .filter(m => m != null)

    } else if (recipientType === 'mailing_list' && isSuper) {
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

    // Validate email addresses
    const { valid: validRecipients, invalid: invalidRecipients } = validateRecipients(recipients)

    if (validRecipients.length === 0) {
      return NextResponse.json({
        error: 'No valid email addresses found',
        details: `All ${invalidRecipients.length} recipients have invalid email addresses`
      }, { status: 400 })
    }

    // Log warning if some recipients are invalid
    if (invalidRecipients.length > 0) {
      console.warn(`Skipping ${invalidRecipients.length} recipients with invalid emails:`,
        invalidRecipients.map(r => ({ email: r.email, reason: r.reason }))
      )
    }

    // Wrap content in HTML email template
    const htmlContent = wrapEmailTemplate(content)

    // Use provided sender name or default to "Labor Party"
    const fromName = senderName || 'Labor Party'

    // Format recipients for Resend
    const formattedRecipients = validRecipients.map(r => ({
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

    // Log the email send (ignore errors if table doesn't exist)
    try {
      await supabase.from('email_logs').insert({
        admin_id: admin.teamMemberId,
        subject,
        recipient_type: recipientType,
        chapter_id: chapterId || admin.chapterId,
        status: 'sent',
        recipient_count: validRecipients.length,
        skipped_count: invalidRecipients.length,
      })
    } catch {
      // Table might not exist yet, that's ok
    }

    const responseMessage = invalidRecipients.length > 0
      ? `Email sent to ${validRecipients.length} recipient${validRecipients.length !== 1 ? 's' : ''}. Skipped ${invalidRecipients.length} invalid email${invalidRecipients.length !== 1 ? 's' : ''}.`
      : `Email sent to ${validRecipients.length} recipient${validRecipients.length !== 1 ? 's' : ''}`

    return NextResponse.json({
      success: true,
      message: responseMessage,
      count: validRecipients.length,
      skipped: invalidRecipients.length,
    })
  } catch (error) {
    console.error('Email send error:', error)
    return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 500 })
  }
}
