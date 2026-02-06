import { useState, useEffect } from 'react'

/**
 * Email preferences modal - reply-to and signature in one place
 */
export default function PreferencesModal({
  show,
  onClose,
  preferences,
  setPreferences,
  onSave,
  saving
}) {
  const [localSignature, setLocalSignature] = useState('')

  // Sync signature when modal opens or preferences change
  useEffect(() => {
    if (show) {
      setLocalSignature(preferences.default_signature || '')
    }
  }, [show, preferences.default_signature])

  if (!show) return null

  const handleSave = async () => {
    const updatedPrefs = {
      ...preferences,
      default_signature: localSignature
    }
    setPreferences(updatedPrefs)
    await onSave(updatedPrefs)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between p-4 border-b border-stone-200">
          <h2 className="text-base font-semibold text-gray-900">Email Settings</h2>
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
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Default Reply-To Email
            </label>
            <input
              type="email"
              value={preferences.default_reply_to || ''}
              onChange={(e) => setPreferences({ ...preferences, default_reply_to: e.target.value })}
              placeholder="your-email@example.com"
              className="input-field text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Pre-filled when you compose emails
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Email Signature
            </label>
            <textarea
              value={localSignature}
              onChange={(e) => setLocalSignature(e.target.value)}
              placeholder="In solidarity,&#10;Your Name"
              rows={4}
              className="input-field text-sm font-mono"
              style={{ resize: 'vertical' }}
            />
            <p className="text-xs text-gray-400 mt-1">
              Added to the end of your emails. Use HTML for formatting.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-stone-200 bg-stone-50 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-sm px-3 py-1.5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm px-3 py-1.5"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
