'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import FileBrowser from '@/components/FileBrowser'
import FileUploader from '@/components/FileUploader'

export default function AdminFilesPage() {
  const [adminInfo, setAdminInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetchAdminInfo()
  }, [])

  const fetchAdminInfo = async () => {
    try {
      // Fetch admin records to determine allowed buckets
      const res = await fetch('/api/admin/admins/me')
      if (res.ok) {
        const data = await res.json()
        setAdminInfo(data)
      }
    } catch (err) {
      console.error('Failed to fetch admin info:', err)
    } finally {
      setLoading(false)
    }
  }

  // Determine allowed buckets based on admin role
  const getAllowedBuckets = () => {
    if (!adminInfo) return ['public']

    const { highestRole, isMediaTeam, chapterId } = adminInfo

    const buckets = ['public']

    // Chapter access
    if (chapterId || ['super_admin', 'national_admin'].includes(highestRole)) {
      buckets.push('chapters')
    }

    // Media access
    if (isMediaTeam || ['super_admin', 'national_admin'].includes(highestRole)) {
      buckets.push('media/social', 'media/podcast')
    }

    // Internal docs (super/national only)
    if (['super_admin', 'national_admin'].includes(highestRole)) {
      buckets.push('internal-docs')
    }

    return buckets
  }

  const handleUploadComplete = () => {
    // Refresh the file browser
    setRefreshKey(prev => prev + 1)
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  const allowedBuckets = getAllowedBuckets()

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Link href="/admin" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block">
        &larr; Back to Admin Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl text-gray-900">File Manager</h1>
        <p className="text-gray-600 mt-1">
          Upload and manage files for your organization
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Upload Section */}
        <div className="lg:col-span-1">
          <div className="card sticky top-4">
            <h2 className="text-xl font-semibold mb-4">Upload Files</h2>
            <FileUploader
              allowedBuckets={allowedBuckets}
              chapterId={adminInfo?.chapterId}
              onUploadComplete={handleUploadComplete}
              maxFiles={5}
            />
          </div>
        </div>

        {/* Browser Section */}
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Browse Files</h2>
            <FileBrowser
              key={refreshKey}
              allowedBuckets={allowedBuckets}
              chapterId={['super_admin', 'national_admin'].includes(adminInfo?.highestRole) ? null : adminInfo?.chapterId}
              showDelete={true}
            />
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-2">Storage Buckets</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li><strong>Public Files:</strong> Logos, brand assets accessible by anyone</li>
          <li><strong>Chapter Documents:</strong> Files specific to your chapter</li>
          {(adminInfo?.isMediaTeam || ['super_admin', 'national_admin'].includes(adminInfo?.highestRole)) && (
            <>
              <li><strong>Social Media:</strong> Short-form video content for social platforms</li>
              <li><strong>Podcast:</strong> Audio files and episode content</li>
            </>
          )}
          {['super_admin', 'national_admin'].includes(adminInfo?.highestRole) && (
            <li><strong>Internal Documents:</strong> Organization-wide internal files</li>
          )}
        </ul>
      </div>
    </div>
  )
}
