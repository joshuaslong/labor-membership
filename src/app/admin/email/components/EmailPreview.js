import { DEFAULT_SIGNATURE } from '../utils/emailTemplates'

/**
 * Email preview - shows how the email will look
 * Designed to work in the sticky sidebar column
 */
export default function EmailPreview({
  subject,
  content,
  senderName,
  replyTo,
  signature
}) {
  // Apply personalization for preview
  const previewContent = content
    .replace(/\{\$name\}/g, 'Member')
    .replace(/\{\$SIGNATURE\}/g, signature || DEFAULT_SIGNATURE)

  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
      {/* Email header */}
      <div className="border-b border-stone-200 p-4 text-sm space-y-1 bg-stone-50">
        <div className="flex">
          <span className="text-stone-500 w-16 flex-shrink-0">From</span>
          <span className="text-gray-900 truncate">{senderName || 'Labor Party'}</span>
        </div>
        {replyTo && (
          <div className="flex">
            <span className="text-stone-500 w-16 flex-shrink-0">Reply</span>
            <span className="text-gray-900 truncate">{replyTo}</span>
          </div>
        )}
        <div className="flex">
          <span className="text-stone-500 w-16 flex-shrink-0">Subject</span>
          <span className="text-gray-900 font-medium truncate">{subject || '(No subject)'}</span>
        </div>
      </div>

      {/* Email body */}
      <div className="p-4">
        {content ? (
          <div
            className="email-preview text-sm"
            dangerouslySetInnerHTML={{ __html: previewContent }}
          />
        ) : (
          <p className="text-stone-400 text-sm italic">
            Start typing to see preview...
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-stone-200 p-4 text-center text-xs text-stone-500 bg-stone-50">
        <p className="font-medium">Labor Party</p>
        <p className="text-labor-red mt-1">Unsubscribe</p>
      </div>
    </div>
  )
}
