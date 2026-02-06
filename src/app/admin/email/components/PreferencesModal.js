/**
 * Email preferences modal
 */
export default function PreferencesModal({
  show,
  onClose,
  preferences,
  setPreferences,
  onSave,
  saving,
  onEditSignature
}) {
  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <h2 className="text-lg font-semibold text-gray-900">Email Preferences</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
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
              Pre-filled when you compose emails
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Default Signature
            </label>
            {preferences.default_signature ? (
              <div className="mb-2 p-3 bg-stone-50 border border-stone-200 rounded text-sm text-gray-700 whitespace-pre-wrap">
                {preferences.default_signature}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-2">No signature set</p>
            )}
            <button
              type="button"
              onClick={onEditSignature}
              className="text-sm text-labor-red hover:underline"
            >
              {preferences.default_signature ? 'Edit signature' : 'Add signature'}
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-stone-200 bg-stone-50 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave()
              onClose()
            }}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
