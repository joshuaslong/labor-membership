import Link from 'next/link'

/**
 * Success modal shown after email is sent
 */
export default function EmailSentModal({ emailSentInfo, onClose }) {
  if (!emailSentInfo) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Email Sent!</h2>
        <p className="text-gray-600 mb-6">
          Your email was successfully sent to {emailSentInfo.count} recipient{emailSentInfo.count !== 1 ? 's' : ''}.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="btn-primary px-6 py-2"
          >
            Send Another Email
          </button>
          <Link
            href="/admin"
            className="btn-secondary px-6 py-2"
          >
            Back to Admin
          </Link>
        </div>
      </div>
    </div>
  )
}
