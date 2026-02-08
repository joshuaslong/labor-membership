import { r2Client } from '@/lib/r2'
import { GetObjectCommand } from '@aws-sdk/client-s3'

export async function GET(request, { params }) {
  try {
    const { key } = await params
    const r2Key = `public/email-images/${key.join('/')}`

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2Key,
    })

    const response = await r2Client.send(command)

    return new Response(response.Body, {
      headers: {
        'Content-Type': response.ContentType || 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    return new Response('Image not found', { status: 404 })
  }
}
