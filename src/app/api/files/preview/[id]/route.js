import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { r2Client } from '@/lib/r2'
import { GetObjectCommand } from '@aws-sdk/client-s3'

// GET - Stream image file for preview (avoids CORS issues)
export async function GET(request, { params }) {
  try {
    const { id: fileId } = await params

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

    // Only allow image files
    if (!file.mime_type || !file.mime_type.startsWith('image/')) {
      return NextResponse.json({ error: 'Not an image file' }, { status: 400 })
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

    // Fetch the image from R2
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: file.r2_key,
    })

    const response = await r2Client.send(command)

    // Convert the readable stream to a web stream
    const webStream = response.Body.transformToWebStream()

    // Return the image with proper headers
    return new NextResponse(webStream, {
      headers: {
        'Content-Type': file.mime_type,
        'Cache-Control': 'public, max-age=3600',
        'Content-Length': response.ContentLength?.toString() || '',
      },
    })

  } catch (error) {
    console.error('Preview error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
