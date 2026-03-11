import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { getPresignedUploadUrl, getPresignedDownloadUrl, generateR2Key, BUCKET_PREFIXES } from '@/lib/r2'

const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB per file
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv', 'text/plain',
  'application/zip', 'application/x-zip-compressed',
]

// POST - Get presigned upload URL for a message attachment
export async function POST(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { channelId } = await params
  const supabase = createAdminClient()

  // Verify user is a channel member
  const { data: membership } = await supabase
    .from('channel_members')
    .select('id')
    .eq('channel_id', channelId)
    .eq('team_member_id', teamMember.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 })
  }

  const { filename, contentType, fileSize } = await request.json()

  if (!filename || !contentType) {
    return NextResponse.json({ error: 'filename and contentType are required' }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json({
      error: 'File type not supported. Allowed: images, PDFs, documents, spreadsheets, text files, and ZIP archives.'
    }, { status: 400 })
  }

  if (fileSize && fileSize > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File is too large. Maximum size is 25MB.' }, { status: 400 })
  }

  // Get the channel's chapter for storage path
  const { data: channel } = await supabase
    .from('channels')
    .select('chapter_id, chapters(state_code)')
    .eq('id', channelId)
    .single()

  const stateCode = channel?.chapters?.state_code || 'general'
  const r2Key = generateR2Key(BUCKET_PREFIXES.CHAPTERS, `msg-${filename}`, stateCode)
  const uploadUrl = await getPresignedUploadUrl(r2Key, contentType)

  // Create file record
  const { data: fileRecord, error: fileError } = await supabase
    .from('files')
    .insert({
      r2_key: r2Key,
      bucket_prefix: BUCKET_PREFIXES.CHAPTERS,
      original_filename: filename,
      file_size_bytes: fileSize || null,
      mime_type: contentType,
      access_tier: 'chapter',
      chapter_id: channel?.chapter_id || null,
      uploaded_by: teamMember.user_id,
    })
    .select('id')
    .single()

  if (fileError) {
    console.error('File record error:', fileError)
    return NextResponse.json({ error: 'Failed to create file record' }, { status: 500 })
  }

  return NextResponse.json({
    uploadUrl,
    fileId: fileRecord.id,
    r2Key,
  })
}

// GET - Get download URL for an attachment
export async function GET(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { channelId } = await params
  const supabase = createAdminClient()

  // Verify membership
  const { data: membership } = await supabase
    .from('channel_members')
    .select('id')
    .eq('channel_id', channelId)
    .eq('team_member_id', teamMember.id)
    .single()

  if (!membership) {
    return NextResponse.json({ error: 'Not a member of this channel' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const attachmentId = searchParams.get('attachmentId')

  if (!attachmentId) {
    return NextResponse.json({ error: 'attachmentId is required' }, { status: 400 })
  }

  const { data: attachment } = await supabase
    .from('message_attachments')
    .select('r2_key, original_filename')
    .eq('id', attachmentId)
    .single()

  if (!attachment) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  }

  const downloadUrl = await getPresignedDownloadUrl(attachment.r2_key, 3600, attachment.original_filename)

  return NextResponse.json({ downloadUrl })
}
