'use client'

import { useSearchParams } from 'next/navigation'
import FileBrowser from '@/components/FileBrowser'

const BUCKET_LABELS = {
  'public': 'Public Files',
  'chapters': 'Chapter Documents',
  'media/social': 'Social Media',
  'media/podcast': 'Podcast',
  'internal-docs': 'Internal Documents',
}

export default function ResourceBrowser({ allowedBuckets = ['public'], chapterId = null }) {
  const searchParams = useSearchParams()
  const bucketParam = searchParams.get('bucket')

  // If a specific bucket is selected via sidebar, filter to just that one
  const activeBuckets = bucketParam && allowedBuckets.includes(bucketParam)
    ? [bucketParam]
    : allowedBuckets

  const pageTitle = bucketParam && BUCKET_LABELS[bucketParam]
    ? BUCKET_LABELS[bucketParam]
    : 'All Files'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{pageTitle}</h1>
      </div>

      <FileBrowser
        allowedBuckets={activeBuckets}
        chapterId={chapterId}
        showDelete={true}
      />
    </div>
  )
}
