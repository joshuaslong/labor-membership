/**
 * Compact action bar for test and send
 */
export default function EmailActions({
  testEmail,
  setTestEmail,
  onTestEmail,
  testLoading,
  loading,
  canSend,
  subject,
  content
}) {
  return (
    <div className="space-y-3">
      {/* Test Email */}
      <div className="flex items-center gap-2">
        <input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="Test email address..."
          className="flex-1 text-sm px-3 py-2 bg-white text-gray-900 border border-stone-300 rounded placeholder:text-gray-500 focus:outline-none focus:border-labor-red focus:ring-1 focus:ring-labor-red"
        />
        <button
          type="button"
          onClick={onTestEmail}
          disabled={testLoading || !subject || !content || !testEmail}
          className="btn-secondary px-4 py-2 text-sm whitespace-nowrap"
        >
          {testLoading ? 'Sending...' : 'Send Test'}
        </button>
      </div>

      {/* Send Button */}
      <button
        type="submit"
        disabled={loading || !canSend}
        className="btn-primary w-full py-3 text-base font-medium"
      >
        {loading ? 'Sending...' : 'Send Email'}
      </button>
    </div>
  )
}
