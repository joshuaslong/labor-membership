/**
 * Sender details section - name and reply-to address
 */
export default function SenderSection({
  senderName,
  setSenderName,
  replyTo,
  setReplyTo
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Sender Details
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            From Name
          </label>
          <input
            type="text"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Labor Party"
            className="input-field text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Reply-To Email
          </label>
          <input
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="your@email.com"
            className="input-field text-sm"
          />
        </div>
      </div>
    </div>
  )
}
