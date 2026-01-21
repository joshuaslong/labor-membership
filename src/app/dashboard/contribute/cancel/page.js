import Link from 'next/link'

export default function ContributeCancelPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="card text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="text-2xl text-gray-900 mb-2">Payment Cancelled</h1>
        <p className="text-gray-600 mb-8">
          No worries—your payment was cancelled and you haven't been charged. You can try again whenever you're ready.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard/contribute" className="btn-primary">
            Try Again
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
