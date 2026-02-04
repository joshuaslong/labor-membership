/**
 * Modal for editing email signature
 */
export default function SignatureModal({
  show,
  signature,
  setSignature,
  onSave,
  onClose,
  saving
}) {
  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Email Signature</h2>
        <p className="text-sm text-gray-600 mb-4">
          Use HTML for formatting (e.g., &lt;br&gt; for line breaks, &lt;strong&gt; for bold).
          This signature will automatically replace the {'{$SIGNATURE}'} marker in email templates.
        </p>
        <textarea
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder="In solidarity,&#10;Your Name&#10;Your Title"
          rows={8}
          className="w-full px-3 py-2 bg-white text-gray-900 border border-stone-200 rounded focus:outline-none focus:border-labor-red focus:ring-1 focus:ring-labor-red font-mono text-sm"
          style={{ resize: 'vertical' }}
          autoFocus
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={onSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Saving...' : 'Save Signature'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
