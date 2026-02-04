import Link from 'next/link'

/**
 * Test email and send email actions
 */
export default function EmailActions({
  testEmail,
  setTestEmail,
  onTestEmail,
  testLoading,
  onSendEmail,
  loading,
  canSend,
  subject,
  content
}) {
  return (
    <>
      {/* Test Email */}
      <div className="card rounded-none sm:rounded-lg mx-0">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Email</h2>
        <p className="text-sm text-gray-600 mb-4">
          Send a test version to verify formatting before sending to members.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter test email address..."
            className="input-field flex-1"
          />
          <button
            type="button"
            onClick={onTestEmail}
            disabled={testLoading || !subject || !content || !testEmail}
            className="btn-secondary px-6 whitespace-nowrap"
          >
            {testLoading ? 'Sending...' : 'Send Test'}
          </button>
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-4 px-4 sm:px-0 pb-4 sm:pb-0">
        <button
          type="submit"
          disabled={loading || !canSend}
          className="btn-primary py-3 px-8 flex-1 sm:flex-none"
        >
          {loading ? 'Sending...' : 'Send Email'}
        </button>
        <Link href="/admin" className="btn-secondary py-3 px-8 flex-1 sm:flex-none text-center">
          Cancel
        </Link>
      </div>
    </>
  )
}
