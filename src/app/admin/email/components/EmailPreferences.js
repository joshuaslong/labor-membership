/**
 * Email preferences panel (collapsible)
 */
export default function EmailPreferences({
  preferences,
  setPreferences,
  showPreferences,
  setShowPreferences,
  savingPreferences,
  handleSavePreferences,
  handleOpenSignatureModal
}) {
  return (
    <div className="card rounded-none sm:rounded-lg mx-0 mb-4 sm:mb-6">
      <button
        type="button"
        onClick={() => setShowPreferences(!showPreferences)}
        className="w-full flex items-center justify-between text-left"
      >
        <h2 className="text-lg font-semibold text-gray-900">Email Preferences</h2>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${showPreferences ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <p className="text-sm text-gray-600 mt-1">
        Set default reply-to email and signature for all your emails.
      </p>

      {showPreferences && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Reply-To Email
            </label>
            <input
              type="email"
              value={preferences.default_reply_to || ''}
              onChange={(e) => setPreferences({ ...preferences, default_reply_to: e.target.value })}
              placeholder="your-email@example.com"
              className="input-field"
            />
            <p className="text-xs text-gray-500 mt-1">
              This will be pre-filled as your reply-to address each time you compose an email.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Signature / Sign-off
            </label>
            {preferences.default_signature ? (
              <div className="mb-2 p-3 bg-stone-50 border border-stone-200 rounded text-sm text-gray-700 font-mono whitespace-pre-wrap">
                {preferences.default_signature}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-2">No signature set</p>
            )}
            <button
              type="button"
              onClick={handleOpenSignatureModal}
              className="btn-secondary text-sm"
            >
              {preferences.default_signature ? 'Edit Signature' : 'Add Signature'}
            </button>
            <p className="text-xs text-gray-500 mt-2">
              This signature automatically replaces the {'{$SIGNATURE}'} marker in email templates.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleSavePreferences}
              disabled={savingPreferences}
              className="btn-primary"
            >
              {savingPreferences ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
