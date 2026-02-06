import { Suspense } from 'react'
import PollsList from './PollsList'

export default function WorkspacePollsPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4">
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Polls</h1>
        </div>
        <div className="bg-white border border-stone-200 rounded p-8 text-center text-gray-500">
          Loading polls...
        </div>
      </div>
    }>
      <PollsList />
    </Suspense>
  )
}
