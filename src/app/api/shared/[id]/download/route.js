import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getPresignedDownloadUrl } from '@/lib/r2'

export async function GET(request, { params }) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    const { data: file, error } = await supabase
      .from('files')
      .select('id, r2_key, original_filename, access_tier, deleted_at')
      .eq('id', id)
      .single()

    if (error || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    if (file.access_tier !== 'public' || file.deleted_at) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const downloadUrl = await getPresignedDownloadUrl(
      file.r2_key,
      3600,
      file.original_filename
    )

    return NextResponse.redirect(downloadUrl)
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: 'Download failed' }, { status: 500 })
  }
}
