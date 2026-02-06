import Link from 'next/link'

/**
 * Success modal shown after email is sent
 */
export default function EmailSentModal({ emailSentInfo, onClose }) {
  if (!emailSentInfo) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full">
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-1">Email Sent</h2>
          <p className="text-sm text-gray-600">
            Successfully sent to {emailSentInfo.count} recipient{emailSentInfo.count !== 1 ? 's' : ''}.
          </p>
        </div>

        <div className="flex gap-2 p-4 border-t border-stone-200 bg-stone-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="btn-primary flex-1 text-sm px-3 py-2"
          >
            Send Another
          </button>
          <Link
            href="/admin"
            className="btn-secondary flex-1 text-sm px-3 py-2 text-center"
          >
            Back to Admin
          </Link>
        </div>
      </div>
    </div>
  )
}
