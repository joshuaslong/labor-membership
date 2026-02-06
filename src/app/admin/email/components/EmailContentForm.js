import EmailEditor from '@/components/EmailEditor'
import { EMAIL_TEMPLATES } from '../utils/emailTemplates'

/**
 * Email content composition form - template, subject, and editor
 */
export default function EmailContentForm({
  selectedTemplate,
  handleTemplateChange,
  subject,
  setSubject,
  content,
  setContent
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
          Content
        </h3>
        <select
          value={selectedTemplate}
          onChange={(e) => handleTemplateChange(e.target.value)}
          className="text-sm border-stone-200 rounded-md focus:border-labor-red focus:ring-labor-red"
        >
          {EMAIL_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Subject Line
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter email subject..."
          className="input-field text-base"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Message
        </label>
        <div className="border border-stone-200 rounded-lg overflow-hidden bg-white">
          <EmailEditor
            value={content}
            onChange={setContent}
            placeholder="Write your email..."
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Use <code className="bg-stone-100 px-1 py-0.5 rounded text-labor-red">{'{$name}'}</code> to personalize with recipient's first name
        </p>
      </div>
    </div>
  )
}
