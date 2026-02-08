import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { r2Client, generateR2Key, BUCKET_PREFIXES, getPublicUrl } from '@/lib/r2'
import { PutObjectCommand } from '@aws-sdk/client-s3'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(request) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('image')

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid image type. Allowed: JPEG, PNG, GIF, WebP' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Image too large. Maximum 5MB.' }, { status: 400 })
    }

    const key = generateR2Key(BUCKET_PREFIXES.PUBLIC, file.name)
    const buffer = Buffer.from(await file.arrayBuffer())

    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }))

    const url = getPublicUrl(key)

    if (!url) {
      return NextResponse.json({ error: 'R2_PUBLIC_URL is not configured. Cannot serve email images.' }, { status: 500 })
    }

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
