import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getPresignedDownloadUrl, getPublicUrl, fileExists } from '@/lib/r2'

// GET - Get presigned download URL for a file
export async function GET(request, { params }) {
  try {
    const { id: fileId } = await params
    const { searchParams } = new URL(request.url)
    const isPreview = searchParams.get('preview') === 'true'

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const adminClient = createAdminClient()

    // Get file metadata
    const { data: file, error: fileError } = await adminClient
      .from('files')
      .select('*')
      .eq('id', fileId)
      .is('deleted_at', null)
      .single()

    if (fileError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check access permission using RPC
    const { data: canAccess, error: rpcError } = await adminClient.rpc('can_access_file', {
      file_uuid: fileId,
      user_uuid: user?.id || null
    })

    if (rpcError) {
      console.error('RPC error:', rpcError)
      return NextResponse.json({ error: 'Permission check failed' }, { status: 500 })
    }

    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Verify file exists in R2 storage
    const exists = await fileExists(file.r2_key)
    if (!exists) {
      // Clean up orphan database record
      await adminClient
        .from('files')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', fileId)

      return NextResponse.json({
        error: 'This file is no longer available. It may have been deleted or failed to upload properly.'
      }, { status: 404 })
    }

    // For public files, try to return public URL if available
    if (file.access_tier === 'public') {
      const publicUrl = getPublicUrl(file.r2_key)
      if (publicUrl) {
        return NextResponse.json({
          url: publicUrl,
          filename: file.original_filename,
          mimeType: file.mime_type,
          size: file.file_size_bytes,
          isPublic: true,
        })
      }
    }

    // Generate presigned download URL
    // Use inline disposition for previews (images), attachment for downloads
    const downloadUrl = await getPresignedDownloadUrl(
      file.r2_key,
      3600,
      file.original_filename,
      isPreview
    )

    return NextResponse.json({
      url: downloadUrl,
      filename: file.original_filename,
      mimeType: file.mime_type,
      size: file.file_size_bytes,
      expiresIn: 3600,
    })

  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
