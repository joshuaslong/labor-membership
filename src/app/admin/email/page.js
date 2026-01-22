'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import EmailEditor from '@/components/EmailEditor'

const LOGO_HEADER = `<p style="text-align: center; margin-bottom: 24px;"><img src="https://members.votelabor.org/logo-dark.png" alt="Labor Party" width="200" style="max-width: 200px; height: auto;" /></p>`

const EMAIL_TEMPLATES = [
  {
    id: 'announcement',
    name: 'General Announcement',
    subject: '',
    content: `${LOGO_HEADER}<p>Dear {$name},</p><p>[Your announcement here]</p><p>In solidarity,<br>Labor Party</p>`,
  },
  {
    id: 'event',
    name: 'Event Invitation',
    subject: "You're Invited: ",
    content: `${LOGO_HEADER}<p>Dear {$name},</p><p>You're invited to join us for an upcoming event!</p><p><strong>Event:</strong> [Event Name]<br><strong>Date:</strong> [Date]<br><strong>Time:</strong> [Time]<br><strong>Location:</strong> [Location/Virtual Link]</p><p>[Additional details about the event]</p><p>We hope to see you there!</p><p>In solidarity,<br>Labor Party</p>`,
  },
  {
    id: 'action',
    name: 'Call to Action',
    subject: 'Action Needed: ',
    content: `${LOGO_HEADER}<p>Dear {$name},</p><p>We need your help with an urgent action.</p><p><strong>What:</strong> [Describe the action]</p><p><strong>Why it matters:</strong> [Explain the importance]</p><p><strong>How you can help:</strong></p><ul><li>[Action item 1]</li><li>[Action item 2]</li><li>[Action item 3]</li></ul><p>Together, we can make a difference.</p><p>In solidarity,<br>Labor Party</p>`,
  },
  {
    id: 'blank',
    name: 'Blank Template',
    subject: '',
    content: `${LOGO_HEADER}<p>Dear {$name},</p><p></p><p>In solidarity,<br>Labor Party</p>`,
  },
]

export default function EmailComposePage() {
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState(EMAIL_TEMPLATES[0].content)
  const [recipientType, setRecipientType] = useState('my_chapter')
  const [selectedChapterId, setSelectedChapterId] = useState('')
  const [replyTo, setReplyTo] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)
  const [chapters, setChapters] = useState([])
  const [adminInfo, setAdminInfo] = useState(null)
  const [adminEmail, setAdminEmail] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('announcement')
  const [testEmail, setTestEmail] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [senderName, setSenderName] = useState('Labor Party')
  const [chapterSearch, setChapterSearch] = useState('')
  const [showChapterDropdown, setShowChapterDropdown] = useState(false)
  const chapterDropdownRef = useRef(null)
  const [showPreferences, setShowPreferences] = useState(false)
  const [preferences, setPreferences] = useState({ default_reply_to: '', default_signature: '' })
  const [savingPreferences, setSavingPreferences] = useState(false)

  // Close chapter dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (chapterDropdownRef.current && !chapterDropdownRef.current.contains(event.target)) {
        setShowChapterDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Get admin info (user can have multiple admin records)
        const { data: adminRecords } = await supabase
          .from('admin_users')
          .select('id, role, chapter_id, chapters(id, name)')
          .eq('user_id', user.id)

        // Use highest privilege role for determining access
        let admin = null
        if (adminRecords && adminRecords.length > 0) {
          const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
          admin = adminRecords.reduce((highest, current) => {
            const currentIndex = roleHierarchy.indexOf(current.role)
            const highestIndex = roleHierarchy.indexOf(highest.role)
            return currentIndex < highestIndex ? current : highest
          }, adminRecords[0])
        }

        setAdminInfo(admin)

        // Get admin's email from members table for default reply-to
        const { data: adminMember } = await supabase
          .from('members')
          .select('email')
          .eq('user_id', user.id)
          .single()

        if (adminMember?.email) {
          setAdminEmail(adminMember.email)
        }

        // Load admin preferences
        try {
          const prefsRes = await fetch('/api/admin/preferences')
          if (prefsRes.ok) {
            const prefsData = await prefsRes.json()
            if (prefsData.preferences) {
              setPreferences(prefsData.preferences)
              // Use saved reply-to if available, otherwise default to admin email
              setReplyTo(prefsData.preferences.default_reply_to || adminMember?.email || '')
              // Apply signature to initial template content
              if (prefsData.preferences.default_signature) {
                setContent(prevContent =>
                  prevContent.replace(/<p>In solidarity,<br>Labor Party<\/p>$/, prefsData.preferences.default_signature)
                )
              }
            }
          }
        } catch (err) {
          console.error('Error loading preferences:', err)
          // Fall back to admin email
          if (adminMember?.email) {
            setReplyTo(adminMember.email)
          }
        }

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
      // Append signature if saved
      let newContent = template.content
      if (preferences.default_signature) {
        // Replace the default "In solidarity,<br>Labor Party" with the custom signature
        newContent = newContent.replace(/<p>In solidarity,<br>Labor Party<\/p>$/, preferences.default_signature)
      }
      setContent(newContent)
    }
  }

  const handleSavePreferences = async () => {
    setSavingPreferences(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSuccess('Preferences saved!')
      // Apply the new reply-to immediately
      if (preferences.default_reply_to) {
        setReplyTo(preferences.default_reply_to)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingPreferences(false)
    }
  }

  const handleTestEmail = async () => {
    setTestLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch('/api/admin/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          content,
          testEmail,
          replyTo: replyTo || undefined,
          senderName: senderName || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send test email')
      }

      setSuccess(`Test email sent to ${testEmail}!`)
    } catch (err) {
      setError(err.message)
    } finally {
      setTestLoading(false)
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
          replyTo: replyTo || undefined,
          senderName: senderName || undefined,
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
      setReplyTo(adminEmail)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const isSuperAdmin = ['super_admin', 'national_admin'].includes(adminInfo?.role)

  return (
    <div className="max-w-4xl mx-auto px-0 sm:px-4 py-4 sm:py-8">
      <Link href="/admin" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block px-4 sm:px-0">
        ← Back to Admin
      </Link>

      <h1 className="text-2xl sm:text-3xl text-gray-900 mb-2 px-4 sm:px-0">Send Email</h1>
      <p className="text-gray-600 mb-6 sm:mb-8 px-4 sm:px-0">
        Compose and send emails to members.
      </p>

      {success && (
        <div className="bg-green-50 text-green-700 p-4 mx-4 sm:mx-0 rounded-lg mb-6 flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 mx-4 sm:mx-0 rounded-lg mb-6 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Recipients */}
        <div className="card rounded-none sm:rounded-lg mx-0">
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
                    <div className="mt-2 relative" ref={chapterDropdownRef}>
                      <div className="relative">
                        <input
                          type="text"
                          value={chapterSearch}
                          onChange={(e) => {
                            setChapterSearch(e.target.value)
                            setShowChapterDropdown(true)
                          }}
                          onFocus={() => setShowChapterDropdown(true)}
                          placeholder={selectedChapterId ? chapters.find(c => c.id === selectedChapterId)?.name || 'Select chapter...' : 'Search chapters...'}
                          className="input-field pr-8"
                        />
                        <button
                          type="button"
                          onClick={() => setShowChapterDropdown(!showChapterDropdown)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      {showChapterDropdown && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                          {chapters
                            .filter(chapter =>
                              chapter.name.toLowerCase().includes(chapterSearch.toLowerCase()) ||
                              chapter.level.toLowerCase().includes(chapterSearch.toLowerCase())
                            )
                            .map(chapter => (
                              <button
                                key={chapter.id}
                                type="button"
                                onClick={() => {
                                  setSelectedChapterId(chapter.id)
                                  setChapterSearch('')
                                  setShowChapterDropdown(false)
                                }}
                                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${selectedChapterId === chapter.id ? 'bg-labor-red-50 text-labor-red' : 'text-gray-700'}`}
                              >
                                {chapter.name} <span className="text-gray-400">({chapter.level})</span>
                              </button>
                            ))}
                          {chapters.filter(chapter =>
                            chapter.name.toLowerCase().includes(chapterSearch.toLowerCase()) ||
                            chapter.level.toLowerCase().includes(chapterSearch.toLowerCase())
                          ).length === 0 && (
                            <div className="px-4 py-2 text-sm text-gray-500">No chapters found</div>
                          )}
                        </div>
                      )}
                    </div>
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

        {/* Preferences */}
        <div className="card rounded-none sm:rounded-lg mx-0">
          <button
            type="button"
            onClick={() => setShowPreferences(!showPreferences)}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="text-lg font-semibold text-gray-900">Email Preferences</h2>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${showPreferences ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <p className="text-sm text-gray-600 mt-1">
            Set default reply-to email and signature for all your emails.
          </p>

          {showPreferences && (
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Reply-To Email
                </label>
                <input
                  type="email"
                  value={preferences.default_reply_to || ''}
                  onChange={(e) => setPreferences({ ...preferences, default_reply_to: e.target.value })}
                  placeholder="your-email@example.com"
                  className="input-field"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be pre-filled as your reply-to address each time you compose an email.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Signature / Sign-off
                </label>
                <textarea
                  value={preferences.default_signature || ''}
                  onChange={(e) => setPreferences({ ...preferences, default_signature: e.target.value })}
                  placeholder="In solidarity,&#10;Your Name&#10;Your Title"
                  rows={4}
                  className="input-field"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This signature will replace the default "In solidarity, Labor Party" when you select a template.
                  Use HTML for formatting (e.g., &lt;br&gt; for line breaks, &lt;strong&gt; for bold).
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={savingPreferences}
                  className="btn-primary"
                >
                  {savingPreferences ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>
          )}
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

        {/* Preview */}
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
                  dangerouslySetInnerHTML={{ __html: content.replace('{$name}', 'Member') }}
                />
                <div className="border-t border-gray-200 pt-4 mt-6 text-center text-xs text-gray-500">
                  <p>Labor Party</p>
                  <p className="text-labor-red">Unsubscribe</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Test Email */}
        <div className="card rounded-none sm:rounded-lg mx-0">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Email</h2>
          <p className="text-sm text-gray-600 mb-4">
            Send a test version to verify formatting before sending to members.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Enter test email address..."
              className="input-field flex-1"
            />
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testLoading || !subject || !content || !testEmail}
              className="btn-secondary px-6 whitespace-nowrap"
            >
              {testLoading ? 'Sending...' : 'Send Test'}
            </button>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4 px-4 sm:px-0 pb-4 sm:pb-0">
          <button
            type="submit"
            disabled={loading || (recipientType === 'chapter' && !selectedChapterId)}
            className="btn-primary py-3 px-8 flex-1 sm:flex-none"
          >
            {loading ? 'Sending...' : 'Send Email'}
          </button>
          <Link href="/admin" className="btn-secondary py-3 px-8 flex-1 sm:flex-none text-center">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
