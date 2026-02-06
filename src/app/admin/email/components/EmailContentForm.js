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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Content
        </h3>
        <select
          value={selectedTemplate}
          onChange={(e) => handleTemplateChange(e.target.value)}
          className="text-xs border border-stone-200 rounded py-1 pl-2 pr-6 text-gray-600 focus:border-labor-red focus:ring-1 focus:ring-labor-red bg-white hover:border-stone-300"
        >
          {EMAIL_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Subject Line
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter email subject..."
          className="input-field text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Message
        </label>
        <div className="border border-stone-200 rounded-lg overflow-hidden bg-white">
          <EmailEditor
            value={content}
            onChange={setContent}
            placeholder="Write your email..."
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Use <code className="bg-stone-100 px-1 py-0.5 rounded text-labor-red">{'{$name}'}</code> to personalize
        </p>
      </div>
    </div>
  )
}
