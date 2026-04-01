import { createAdminClient } from '@/lib/supabase/server'
import { formatFileSize } from '@/lib/r2'
import Link from 'next/link'

const FILE_TYPE_LABELS = {
  'application/pdf': 'PDF Document',
  'application/msword': 'Word Document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document',
  'application/vnd.ms-excel': 'Excel Spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet',
  'application/vnd.ms-powerpoint': 'PowerPoint Presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint Presentation',
  'text/csv': 'CSV File',
  'text/plain': 'Text File',
  'image/jpeg': 'JPEG Image',
  'image/png': 'PNG Image',
  'image/gif': 'GIF Image',
  'image/webp': 'WebP Image',
}

function getFileTypeLabel(mimeType, filename) {
  if (FILE_TYPE_LABELS[mimeType]) return FILE_TYPE_LABELS[mimeType]
  const ext = filename?.split('.').pop()?.toUpperCase()
  return ext ? `${ext} File` : 'File'
}

export async function generateMetadata({ params }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: file } = await supabase
    .from('files')
    .select('original_filename')
    .eq('id', id)
    .eq('access_tier', 'public')
    .is('deleted_at', null)
    .single()

  return {
    title: file ? `Download: ${file.original_filename}` : 'File Not Found',
    description: file ? `Download ${file.original_filename}` : 'The requested file could not be found.',
  }
}

export default async function SharedFilePage({ params }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: file, error } = await supabase
    .from('files')
    .select('id, original_filename, file_size_bytes, mime_type, access_tier, deleted_at, uploaded_at')
    .eq('id', id)
    .single()

  const notFound = !file || error || file.access_tier !== 'public' || file.deleted_at

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {notFound ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-gray-900 mb-1">File Not Found</h1>
            <p className="text-sm text-gray-500 mb-6">
              This file may have been removed or the link is invalid.
            </p>
            <Link
              href="/"
              className="text-sm text-labor-red hover:underline"
            >
              Go to homepage
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            {/* File info */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-labor-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>

              <h1 className="text-lg font-semibold text-gray-900 mb-1 break-words">
                {file.original_filename}
              </h1>

              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <span>{getFileTypeLabel(file.mime_type, file.original_filename)}</span>
                {file.file_size_bytes && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span>{formatFileSize(file.file_size_bytes)}</span>
                  </>
                )}
              </div>
            </div>

            {/* Download button */}
            <a
              href={`/api/shared/${file.id}/download`}
              className="block w-full text-center py-3 px-4 bg-labor-red text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              Download File
            </a>

            <p className="text-xs text-gray-400 text-center mt-4">
              Shared by the Labor Party
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
