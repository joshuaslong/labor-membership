'use client'

import { useRouter } from 'next/navigation'
import FileUploader from '@/components/FileUploader'

export default function ResourceUploader({ allowedBuckets = ['chapters'], chapterId = null }) {
  const router = useRouter()

  const handleUploadComplete = () => {
    router.push('/workspace/resources')
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Upload Files</h1>
      </div>

      <div className="bg-white border border-stone-200 rounded p-4">
        <FileUploader
          allowedBuckets={allowedBuckets}
          chapterId={chapterId}
          onUploadComplete={handleUploadComplete}
          maxFiles={5}
        />
      </div>
    </div>
  )
}
