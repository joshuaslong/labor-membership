/**
 * Sender details section - name and reply-to address
 */
export default function SenderSection({
  senderName,
  setSenderName,
  replyTo,
  setReplyTo,
  defaultReplyTo
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
        Sender Details
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            From Name
          </label>
          <input
            type="text"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Labor Party"
            className="input-field"
          />
          <p className="text-xs text-gray-500 mt-1">
            Shown in recipient's inbox
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Reply-To Email
          </label>
          <input
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="your@email.com"
            className="input-field"
          />
          <p className="text-xs text-gray-500 mt-1">
            {defaultReplyTo ? 'Using your saved default' : 'Where replies go'}
          </p>
        </div>
      </div>
    </div>
  )
}
