import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import {
  getPresignedUploadUrl,
  generateR2Key,
  isAllowedFileType,
  getMaxFileSize,
  BUCKET_PREFIXES,
  PREFIX_TO_ACCESS_TIER,
} from '@/lib/r2'

// POST - Get presigned URL for upload
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const body = await request.json()
    const { filename, contentType, fileSize, bucketPrefix, chapterId, description, tags } = body

    if (!filename || !contentType || !bucketPrefix) {
      return NextResponse.json({ error: 'Missing required fields: filename, contentType, bucketPrefix' }, { status: 400 })
    }

    // Validate bucket prefix
    const validPrefixes = Object.values(BUCKET_PREFIXES)
    if (!validPrefixes.includes(bucketPrefix)) {
      return NextResponse.json({ error: 'Invalid bucket prefix' }, { status: 400 })
    }

    // Validate file type
    if (!isAllowedFileType(bucketPrefix, contentType)) {
      return NextResponse.json({
        error: `File type "${contentType}" not allowed for this bucket`
      }, { status: 400 })
    }

    // Validate file size
    const maxSize = getMaxFileSize(bucketPrefix)
    if (fileSize && fileSize > maxSize) {
      return NextResponse.json({
        error: `File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`
      }, { status: 400 })
    }

    // Check upload permission using RPC
    const { data: canUpload, error: rpcError } = await adminClient.rpc('can_upload_to_bucket', {
      bucket: bucketPrefix,
      chapter_uuid: chapterId || null,
      user_uuid: user.id
    })

    if (rpcError) {
      console.error('RPC error:', rpcError)
      return NextResponse.json({ error: 'Permission check failed' }, { status: 500 })
    }

    if (!canUpload) {
      return NextResponse.json({ error: 'Permission denied for this bucket' }, { status: 403 })
    }

    // For chapter files, get state code for path
    let stateCode = null
    if (bucketPrefix === BUCKET_PREFIXES.CHAPTERS) {
      if (chapterId) {
        const { data: chapter } = await adminClient
          .from('chapters')
          .select('state_code')
          .eq('id', chapterId)
          .single()
        stateCode = chapter?.state_code || 'general'
      } else {
        // Get admin's chapter if no chapter specified
        const { data: adminRecords } = await adminClient
          .from('admin_users')
          .select('chapter_id, chapters(state_code)')
          .eq('user_id', user.id)
          .not('chapter_id', 'is', null)
          .limit(1)

        if (adminRecords?.[0]?.chapters?.state_code) {
          stateCode = adminRecords[0].chapters.state_code
        } else {
          stateCode = 'general'
        }
      }
    }

    // Generate unique R2 key
    const r2Key = generateR2Key(bucketPrefix, filename, stateCode)

    // Get presigned upload URL
    const uploadUrl = await getPresignedUploadUrl(r2Key, contentType)

    // Determine access tier based on bucket prefix
    const accessTier = PREFIX_TO_ACCESS_TIER[bucketPrefix] || 'chapter'

    // Create file metadata record
    const { data: fileRecord, error: insertError } = await adminClient
      .from('files')
      .insert({
        r2_key: r2Key,
        bucket_prefix: bucketPrefix,
        original_filename: filename,
        file_size_bytes: fileSize || null,
        mime_type: contentType,
        access_tier: accessTier,
        chapter_id: chapterId || null,
        description: description || null,
        tags: tags || null,
        uploaded_by: user.id,
      })
      .select()
      .single()

    if (insertError) throw insertError

    return NextResponse.json({
      uploadUrl,
      fileId: fileRecord.id,
      r2Key,
      expiresIn: 3600,
    })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
