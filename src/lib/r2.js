import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// R2 Configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL

// Create S3-compatible client for R2
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || '',
  },
})

// Bucket prefixes
export const BUCKET_PREFIXES = {
  PUBLIC: 'public',
  CHAPTERS: 'chapters',
  MEDIA_SOCIAL: 'media/social',
  MEDIA_PODCAST: 'media/podcast',
  INTERNAL_DOCS: 'internal-docs',
}

// Access tier to bucket prefix mapping
export const ACCESS_TIER_MAP = {
  public: BUCKET_PREFIXES.PUBLIC,
  members: BUCKET_PREFIXES.PUBLIC,
  chapter: BUCKET_PREFIXES.CHAPTERS,
  media: null, // Can be social or podcast
  internal: BUCKET_PREFIXES.INTERNAL_DOCS,
}

// Bucket prefix to access tier mapping
export const PREFIX_TO_ACCESS_TIER = {
  [BUCKET_PREFIXES.PUBLIC]: 'public',
  [BUCKET_PREFIXES.CHAPTERS]: 'chapter',
  [BUCKET_PREFIXES.MEDIA_SOCIAL]: 'media',
  [BUCKET_PREFIXES.MEDIA_PODCAST]: 'media',
  [BUCKET_PREFIXES.INTERNAL_DOCS]: 'internal',
}

/**
 * Generate a presigned URL for uploading a file
 */
export async function getPresignedUploadUrl(key, contentType, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  })

  return getSignedUrl(r2Client, command, { expiresIn })
}

/**
 * Generate a presigned URL for downloading a file
 */
export async function getPresignedDownloadUrl(key, expiresIn = 3600, filename = null) {
  const commandParams = {
    Bucket: R2_BUCKET_NAME,
    Key: key,
  }

  if (filename) {
    commandParams.ResponseContentDisposition = `attachment; filename="${filename}"`
  }

  const command = new GetObjectCommand(commandParams)
  return getSignedUrl(r2Client, command, { expiresIn })
}

/**
 * Get public URL for files in the public/ prefix
 */
export function getPublicUrl(key) {
  if (!R2_PUBLIC_URL) return null
  if (!key.startsWith('public/')) return null
  return `${R2_PUBLIC_URL}/${key}`
}

/**
 * Delete a file from R2
 */
export async function deleteFile(key) {
  const command = new DeleteObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  })

  await r2Client.send(command)
}

/**
 * List files in a prefix
 */
export async function listFiles(prefix, maxKeys = 100, continuationToken = null) {
  const commandParams = {
    Bucket: R2_BUCKET_NAME,
    Prefix: prefix,
    MaxKeys: maxKeys,
  }

  if (continuationToken) {
    commandParams.ContinuationToken = continuationToken
  }

  const command = new ListObjectsV2Command(commandParams)
  const response = await r2Client.send(command)

  return {
    files: (response.Contents || []).map(obj => ({
      key: obj.Key,
      size: obj.Size,
      lastModified: obj.LastModified,
    })),
    nextToken: response.IsTruncated ? response.NextContinuationToken : null,
  }
}

/**
 * Generate a unique R2 key for a new upload
 */
export function generateR2Key(prefix, filename, stateCode = null) {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 8)
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')

  if (prefix === BUCKET_PREFIXES.CHAPTERS && stateCode) {
    return `${prefix}/${stateCode}/${timestamp}-${randomStr}-${sanitizedFilename}`
  }

  return `${prefix}/${timestamp}-${randomStr}-${sanitizedFilename}`
}

/**
 * Validate file type against allowed types for a bucket
 */
export function isAllowedFileType(prefix, mimeType) {
  const allowedTypes = {
    [BUCKET_PREFIXES.PUBLIC]: [
      'image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp',
      'application/pdf',
    ],
    [BUCKET_PREFIXES.CHAPTERS]: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv', 'text/plain',
    ],
    [BUCKET_PREFIXES.MEDIA_SOCIAL]: [
      'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    ],
    [BUCKET_PREFIXES.MEDIA_PODCAST]: [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/x-m4a',
      'video/mp4', 'video/quicktime',
    ],
    [BUCKET_PREFIXES.INTERNAL_DOCS]: [
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv',
      'image/jpeg', 'image/png', 'image/gif',
    ],
  }

  const allowed = allowedTypes[prefix] || []
  return allowed.includes(mimeType)
}

/**
 * Get maximum file size for a bucket (in bytes)
 */
export function getMaxFileSize(prefix) {
  const maxSizes = {
    [BUCKET_PREFIXES.PUBLIC]: 10 * 1024 * 1024,           // 10MB
    [BUCKET_PREFIXES.CHAPTERS]: 50 * 1024 * 1024,         // 50MB
    [BUCKET_PREFIXES.MEDIA_SOCIAL]: 500 * 1024 * 1024,    // 500MB
    [BUCKET_PREFIXES.MEDIA_PODCAST]: 2 * 1024 * 1024 * 1024, // 2GB
    [BUCKET_PREFIXES.INTERNAL_DOCS]: 100 * 1024 * 1024,   // 100MB
  }

  return maxSizes[prefix] || 10 * 1024 * 1024
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes) {
  if (!bytes) return 'Unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/**
 * Get human-readable bucket label
 */
export function getBucketLabel(prefix) {
  const labels = {
    [BUCKET_PREFIXES.PUBLIC]: 'Public Files',
    [BUCKET_PREFIXES.CHAPTERS]: 'Chapter Documents',
    [BUCKET_PREFIXES.MEDIA_SOCIAL]: 'Social Media',
    [BUCKET_PREFIXES.MEDIA_PODCAST]: 'Podcast',
    [BUCKET_PREFIXES.INTERNAL_DOCS]: 'Internal Documents',
  }
  return labels[prefix] || prefix
}
