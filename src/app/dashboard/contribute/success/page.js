import Link from 'next/link'

export default function ContributeSuccessPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="card text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl text-gray-900 mb-2">Thank you!</h1>
        <p className="text-gray-600 mb-6">
          Your contribution has been received. Together, we're building a party that answers to working people—not corporate donors.
        </p>

        <p className="text-sm text-gray-500 mb-8">
          A receipt has been sent to your email address.
        </p>

        <Link href="/dashboard" className="btn-primary">
          Return to Dashboard
        </Link>
      </div>
    </div>
  )
}
