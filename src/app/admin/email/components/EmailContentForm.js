import EmailEditor from '@/components/EmailEditor'
import { EMAIL_TEMPLATES } from '../utils/emailTemplates'

/**
 * Email content composition form
 */
export default function EmailContentForm({
  selectedTemplate,
  handleTemplateChange,
  senderName,
  setSenderName,
  replyTo,
  setReplyTo,
  subject,
  setSubject,
  content,
  setContent,
  preferences
}) {
  return (
    <>
      {/* Template Selection */}
      <div className="card rounded-none sm:rounded-lg mx-0">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Template</h2>
        <select
          value={selectedTemplate}
          onChange={(e) => handleTemplateChange(e.target.value)}
          className="input-field"
        >
          {EMAIL_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>

      {/* Sender Name */}
      <div className="card rounded-none sm:rounded-lg mx-0">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Sender Name</h2>
        <input
          type="text"
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          placeholder="e.g., Labor Party, Texas Labor Party, Austin Chapter"
          className="input-field"
        />
        <p className="text-xs text-gray-500 mt-2">
          This appears as the "From" name in the recipient's inbox. Examples: "Labor Party", "Texas Labor Party", "Austin Chapter"
        </p>
      </div>

      {/* Reply-To */}
      <div className="card rounded-none sm:rounded-lg mx-0">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Reply-To Address</h2>
        <input
          type="email"
          value={replyTo}
          onChange={(e) => setReplyTo(e.target.value)}
          placeholder="Enter reply-to email address..."
          className="input-field"
        />
        <p className="text-xs text-gray-500 mt-2">
          When recipients reply to this email, their response will be sent to this address.
          {preferences.default_reply_to && ` Using your saved default.`}
        </p>
      </div>

      {/* Email Content */}
      <div className="card rounded-none sm:rounded-lg mx-0 p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Email Content</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
              className="input-field"
              required
            />
          </div>

          <div className="-mx-4 sm:mx-0">
            <label className="block text-sm font-medium text-gray-700 mb-2 px-4 sm:px-0">
              Message
            </label>
            <div className="email-editor-mobile">
              <EmailEditor
                value={content}
                onChange={setContent}
                placeholder="Enter your message..."
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 px-4 sm:px-0">
              Use the <code className="bg-gray-100 px-1 py-0.5 rounded">{'{$}'}</code> button to insert <code className="bg-gray-100 px-1 py-0.5 rounded">{'{$name}'}</code> for the recipient's first name. Click on any image to resize it.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
