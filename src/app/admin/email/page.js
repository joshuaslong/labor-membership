'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const EMAIL_TEMPLATES = [
  {
    id: 'announcement',
    name: 'General Announcement',
    subject: '',
    content: `<p>Dear {$name},</p>

<p>[Your announcement here]</p>

<p>In solidarity,<br>
Labor Party</p>`,
  },
  {
    id: 'event',
    name: 'Event Invitation',
    subject: "You're Invited: ",
    content: `<p>Dear {$name},</p>

<p>You&apos;re invited to join us for an upcoming event!</p>

<p><strong>Event:</strong> [Event Name]<br>
<strong>Date:</strong> [Date]<br>
<strong>Time:</strong> [Time]<br>
<strong>Location:</strong> [Location/Virtual Link]</p>

<p>[Additional details about the event]</p>

<p>We hope to see you there!</p>

<p>In solidarity,<br>
Labor Party</p>`,
  },
  {
    id: 'action',
    name: 'Call to Action',
    subject: 'Action Needed: ',
    content: `<p>Dear {$name},</p>

<p>We need your help with an urgent action.</p>

<p><strong>What:</strong> [Describe the action]</p>

<p><strong>Why it matters:</strong> [Explain the importance]</p>

<p><strong>How you can help:</strong></p>
<ul>
  <li>[Action item 1]</li>
  <li>[Action item 2]</li>
  <li>[Action item 3]</li>
</ul>

<p>Together, we can make a difference.</p>

<p>In solidarity,<br>
Labor Party</p>`,
  },
  {
    id: 'blank',
    name: 'Blank Template',
    subject: '',
    content: `<p>Dear {$name},</p>

<p></p>

<p>In solidarity,<br>
Labor Party</p>`,
  },
]

export default function EmailComposePage() {
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState(EMAIL_TEMPLATES[0].content)
  const [recipientType, setRecipientType] = useState('my_chapter')
  const [selectedChapterId, setSelectedChapterId] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)
  const [chapters, setChapters] = useState([])
  const [adminInfo, setAdminInfo] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState('announcement')

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Get admin info
        const { data: admin } = await supabase
          .from('admin_users')
          .select('id, role, chapter_id, chapters(id, name)')
          .eq('user_id', user.id)
          .single()

        setAdminInfo(admin)

        // Load chapters based on admin role
        if (['super_admin', 'national_admin'].includes(admin?.role)) {
          // Super admins can see all chapters
          const { data: allChapters } = await supabase
            .from('chapters')
            .select('id, name, level')
            .order('name')

          setChapters(allChapters || [])
        } else if (admin?.chapter_id) {
          // Get descendants for chapter admins
          const { data: descendants } = await supabase
            .rpc('get_chapter_descendants', { chapter_uuid: admin.chapter_id })

          // Also include their own chapter
          const chapterIds = [admin.chapter_id, ...(descendants?.map(d => d.id) || [])]

          const { data: accessibleChapters } = await supabase
            .from('chapters')
            .select('id, name, level')
            .in('id', chapterIds)
            .order('name')

          setChapters(accessibleChapters || [])
        }
      }
    }

    loadData()
  }, [])

  const handleTemplateChange = (templateId) => {
    setSelectedTemplate(templateId)
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId)
    if (template) {
      setSubject(template.subject)
      setContent(template.content)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          content,
          recipientType,
          chapterId: selectedChapterId || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send email')
      }

      setSuccess('Email sent successfully!')
      // Clear form
      setSubject('')
      setContent(EMAIL_TEMPLATES[0].content)
      setSelectedTemplate('announcement')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isSuperAdmin = ['super_admin', 'national_admin'].includes(adminInfo?.role)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/admin" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block">
        ← Back to Admin
      </Link>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Send Email</h1>
      <p className="text-gray-600 mb-8">
        Compose and send emails to members via MailerLite.
      </p>

      {!process.env.NEXT_PUBLIC_MAILERLITE_ENABLED && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg mb-6">
          <strong>Note:</strong> MailerLite integration requires the MAILERLITE_API_KEY environment variable to be set.
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Recipients */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recipients</h2>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="recipientType"
                value="my_chapter"
                checked={recipientType === 'my_chapter'}
                onChange={(e) => setRecipientType(e.target.value)}
                className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">My Chapter</span>
                {adminInfo?.chapters?.name && (
                  <span className="text-sm text-gray-500 ml-2">({adminInfo.chapters.name})</span>
                )}
              </div>
            </label>

            {chapters.length > 1 && (
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="recipientType"
                  value="chapter"
                  checked={recipientType === 'chapter'}
                  onChange={(e) => setRecipientType(e.target.value)}
                  className="mt-1 w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">Specific Chapter</span>
                  {recipientType === 'chapter' && (
                    <select
                      value={selectedChapterId}
                      onChange={(e) => setSelectedChapterId(e.target.value)}
                      className="mt-2 input-field"
                    >
                      <option value="">Select a chapter...</option>
                      {chapters.map((chapter) => (
                        <option key={chapter.id} value={chapter.id}>
                          {chapter.name} ({chapter.level})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>
            )}

            {isSuperAdmin && (
              <>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    value="all_members"
                    checked={recipientType === 'all_members'}
                    onChange={(e) => setRecipientType(e.target.value)}
                    className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">All Members</span>
                    <span className="text-sm text-gray-500 ml-2">(National)</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="recipientType"
                    value="mailing_list"
                    checked={recipientType === 'mailing_list'}
                    onChange={(e) => setRecipientType(e.target.value)}
                    className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Mailing List Only</span>
                    <span className="text-sm text-gray-500 ml-2">(Non-member subscribers)</span>
                  </div>
                </label>
              </>
            )}
          </div>
        </div>

        {/* Template Selection */}
        <div className="card">
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

        {/* Email Content */}
        <div className="card">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message
                <span className="text-gray-500 font-normal ml-2">(HTML supported)</span>
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder="Enter your message..."
                className="input-field font-mono text-sm"
                required
              />
              <p className="text-xs text-gray-500 mt-2">
                Use <code className="bg-gray-100 px-1 py-0.5 rounded">{'{$name}'}</code> to insert the recipient's first name.
                Basic HTML tags like <code className="bg-gray-100 px-1 py-0.5 rounded">&lt;p&gt;</code>,{' '}
                <code className="bg-gray-100 px-1 py-0.5 rounded">&lt;strong&gt;</code>,{' '}
                <code className="bg-gray-100 px-1 py-0.5 rounded">&lt;a&gt;</code>,{' '}
                <code className="bg-gray-100 px-1 py-0.5 rounded">&lt;ul&gt;</code>,{' '}
                <code className="bg-gray-100 px-1 py-0.5 rounded">&lt;li&gt;</code> are supported.
              </p>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Preview</h2>
          <div className="border border-gray-200 rounded-lg p-6 bg-white">
            <div className="text-center pb-4 border-b-2 border-labor-red mb-6">
              <span className="text-labor-red font-bold text-xl">Labor Party</span>
            </div>
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: content.replace('{$name}', 'Member') }}
            />
            <div className="border-t border-gray-200 pt-4 mt-6 text-center text-xs text-gray-500">
              <p>Labor Party</p>
              <p className="text-labor-red">Unsubscribe</p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading || (recipientType === 'chapter' && !selectedChapterId)}
            className="btn-primary py-3 px-8"
          >
            {loading ? 'Sending...' : 'Send Email'}
          </button>
          <Link href="/admin" className="btn-secondary py-3 px-8">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
