import { Suspense } from 'react'
import CreateChapterForm from './CreateChapterForm'

export default function CreateChapterPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Create Chapter</h1>
      </div>

      <Suspense fallback={
        <div className="bg-white border border-stone-200 rounded p-8 text-center text-gray-500">
          Loading...
        </div>
      }>
        <CreateChapterForm />
      </Suspense>
    </div>
  )
}
