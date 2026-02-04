import { DEFAULT_SIGNATURE } from '../utils/emailTemplates'

/**
 * Email preview section showing how the email will look
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
    <div className="card rounded-none sm:rounded-lg mx-0 p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview</h2>
      <div className="-mx-4 sm:mx-0">
        <div className="border-y sm:border sm:rounded-lg border-gray-200 bg-white min-h-[50vh] sm:min-h-0">
          {/* Email header preview */}
          <div className="border-b border-gray-200 p-4 text-sm space-y-1">
            <div className="flex">
              <span className="text-gray-500 w-20">From:</span>
              <span className="text-gray-900">{senderName || 'Labor Party'} &lt;noreply@mail.votelabor.org&gt;</span>
            </div>
            {replyTo && (
              <div className="flex">
                <span className="text-gray-500 w-20">Reply-To:</span>
                <span className="text-gray-900">{replyTo}</span>
              </div>
            )}
            <div className="flex">
              <span className="text-gray-500 w-20">Subject:</span>
              <span className="text-gray-900 font-medium">{subject || '(No subject)'}</span>
            </div>
          </div>
          {/* Email body preview */}
          <div className="p-4 sm:p-6">
            <div
              className="email-preview"
              dangerouslySetInnerHTML={{ __html: previewContent }}
            />
            <div className="border-t border-gray-200 pt-4 mt-6 text-center text-xs text-gray-500">
              <p>Labor Party</p>
              <p className="text-labor-red">Unsubscribe</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
