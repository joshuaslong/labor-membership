'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAdminContext } from './hooks/useAdminContext'
import { useEmailPreferences } from './hooks/useEmailPreferences'
import { useEmailForm } from './hooks/useEmailForm'
import { useRecipients } from './hooks/useRecipients'
import { useEmailActions } from './hooks/useEmailActions'
import { useEmailDraft } from './hooks/useEmailDraft'
import { useEmailAttachments } from './hooks/useEmailAttachments'
import { EMAIL_TEMPLATES } from './utils/emailTemplates'

import EmailComposerLayout from '@/components/EmailComposerLayout'
import PreferencesModal from './components/PreferencesModal'
import RecipientSelector from './components/RecipientSelector'
import SenderSection from './components/SenderSection'
import EmailContentForm from './components/EmailContentForm'
import EmailPreview from './components/EmailPreview'
import EmailActions from './components/EmailActions'
import EmailSentModal from './components/EmailSentModal'

export default function EmailComposePage() {
  const [showPreferencesModal, setShowPreferencesModal] = useState(false)

  // Initialize hooks
  const adminContext = useAdminContext()
  const emailForm = useEmailForm(null, adminContext.adminEmail)
  const emailPrefs = useEmailPreferences(
    adminContext.adminEmail,
    emailForm.setReplyTo,
    emailForm.setContent,
    EMAIL_TEMPLATES
  )
  const recipients = useRecipients()
  const actions = useEmailActions()
  const emailAttachments = useEmailAttachments()
  const draft = useEmailDraft({
    subject: emailForm.subject,
    content: emailForm.content,
    senderName: emailForm.senderName,
    replyTo: emailForm.replyTo,
    selectedTemplate: emailForm.selectedTemplate,
    testEmail: emailForm.testEmail,
    recipientType: recipients.recipientType,
    selectedChapterId: recipients.selectedChapterId,
    selectedGroupId: recipients.selectedGroupId,
    groupChapterId: recipients.groupChapterId,
    attachments: emailAttachments.attachments,
  })

  // Load draft on mount (only once when draft is loaded)
  useEffect(() => {
    if (!draft.isDraftLoaded || !adminContext.adminEmail) return

    const savedDraft = draft.loadDraft()
    if (savedDraft) {
      emailForm.setSubject(savedDraft.subject || '')
      emailForm.setContent(savedDraft.content || EMAIL_TEMPLATES[0].content)
      emailForm.setSenderName(savedDraft.senderName || 'Labor Party')
      emailForm.setReplyTo(savedDraft.replyTo || '')
      emailForm.setTestEmail(savedDraft.testEmail || '')
      emailForm.handleTemplateChange(savedDraft.selectedTemplate || 'announcement')
      recipients.setRecipientType(savedDraft.recipientType || 'my_chapter')
      recipients.setSelectedChapterId(savedDraft.selectedChapterId || '')
      recipients.setSelectedGroupId(savedDraft.selectedGroupId || '')
      if (savedDraft.groupChapterId) {
        recipients.handleGroupChapterChange(savedDraft.groupChapterId)
      }
      if (savedDraft.attachments) {
        emailAttachments.restoreAttachments(savedDraft.attachments)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.isDraftLoaded])

  // Loading state
  if (adminContext.loading || emailPrefs.isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-stone-200 rounded w-1/4"></div>
          <div className="h-4 bg-stone-200 rounded w-1/2"></div>
          <div className="h-32 bg-stone-200 rounded"></div>
        </div>
      </div>
    )
  }

  // Unauthorized
  if (!adminContext.adminInfo) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          <p className="font-medium">Access Denied</p>
          <p className="text-sm mt-1">You do not have permission to send emails.</p>
          <Link href="/admin" className="text-labor-red hover:underline text-sm mt-2 inline-block">
            ← Back to Admin
          </Link>
        </div>
      </div>
    )
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()

    const result = await actions.handleSendEmail({
      subject: emailForm.subject,
      content: emailForm.content,
      recipientType: recipients.recipientType,
      chapterId: recipients.selectedChapterId,
      groupId: recipients.selectedGroupId,
      replyTo: emailForm.replyTo,
      senderName: emailForm.senderName
    })

    if (result.success) {
      draft.clearDraft()
      emailForm.resetForm()
      emailAttachments.clearAll()
    }
  }

  // Handle test email
  const handleTestEmail = async () => {
    await actions.handleTestEmail({
      subject: emailForm.subject,
      content: emailForm.content,
      testEmail: emailForm.testEmail,
      replyTo: emailForm.replyTo,
      senderName: emailForm.senderName
    })
  }

  // Clear draft handler
  const handleClearDraft = () => {
    if (confirm('Clear draft? This will reset the form to defaults.')) {
      draft.clearDraft()
      emailForm.resetForm()
      emailAttachments.clearAll()
      recipients.setRecipientType('my_chapter')
      recipients.setSelectedChapterId('')
      recipients.setSelectedGroupId('')
    }
  }

  // Insert attachment download links into email content
  const handleInsertAttachmentLinks = () => {
    if (emailAttachments.uploadedAttachments.length === 0) return

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const linksHtml = emailAttachments.uploadedAttachments
      .map(a => `<li><a href="${baseUrl}/shared/${a.fileId}" target="_blank" rel="noopener">${a.filename}</a></li>`)
      .join('')

    const attachmentBlock = `<p><br></p><p><strong>Attachments:</strong></p><ul>${linksHtml}</ul>`
    emailForm.setContent(emailForm.content + attachmentBlock)
  }

  return (
    <>
      {/* Modals */}
      <EmailSentModal
        emailSentInfo={actions.emailSentInfo}
        onClose={() => actions.setEmailSentInfo(null)}
      />
      <PreferencesModal
        show={showPreferencesModal}
        onClose={() => setShowPreferencesModal(false)}
        preferences={emailPrefs.preferences}
        setPreferences={emailPrefs.setPreferences}
        onSave={emailPrefs.handleSavePreferences}
        saving={emailPrefs.savingPreferences}
      />

      <form onSubmit={handleSubmit}>
        <EmailComposerLayout
          header={
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-4 mb-1">
                  <Link href="/admin" className="text-gray-500 hover:text-gray-900 text-sm">
                    ← Admin
                  </Link>
                </div>
                <h1 className="text-xl font-semibold text-gray-900">Send Email</h1>
                <p className="text-sm text-gray-500 mt-0.5">Compose and send emails to members</p>
              </div>
              {draft.lastSaved && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-stone-500">
                    Saved {new Date(draft.lastSaved).toLocaleTimeString()}
                  </span>
                  <button
                    type="button"
                    onClick={handleClearDraft}
                    className="text-stone-500 hover:text-red-600"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          }
          preview={
            <EmailPreview
              subject={emailForm.subject}
              content={emailForm.content}
              senderName={emailForm.senderName}
              replyTo={emailForm.replyTo}
              signature={emailPrefs.preferences.default_signature}
            />
          }
          actions={
            <EmailActions
              testEmail={emailForm.testEmail}
              setTestEmail={emailForm.setTestEmail}
              onTestEmail={handleTestEmail}
              testLoading={actions.testLoading}
              loading={actions.loading}
              canSend={recipients.isValid() && emailForm.subject && emailForm.content}
              subject={emailForm.subject}
              content={emailForm.content}
            />
          }
        >
          {/* Success/Error Messages */}
          {actions.success && (
            <div className="bg-green-50 text-green-700 p-3 rounded-lg flex justify-between items-center text-sm">
              <span>{actions.success}</span>
              <button onClick={() => actions.setSuccess(null)} className="text-green-600 hover:text-green-800">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {(actions.error || recipients.error) && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg flex justify-between items-center text-sm">
              <span>{actions.error || recipients.error}</span>
              <button
                onClick={() => {
                  actions.setError(null)
                  recipients.setError(null)
                }}
                className="text-red-600 hover:text-red-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Form Sections */}
          <RecipientSelector
            recipientType={recipients.recipientType}
            setRecipientType={recipients.setRecipientType}
            selectedChapterId={recipients.selectedChapterId}
            setSelectedChapterId={recipients.setSelectedChapterId}
            selectedGroupId={recipients.selectedGroupId}
            setSelectedGroupId={recipients.setSelectedGroupId}
            groupChapterId={recipients.groupChapterId}
            groups={recipients.groups}
            groupsLoading={recipients.groupsLoading}
            handleGroupChapterChange={recipients.handleGroupChapterChange}
            adminInfo={adminContext.adminInfo}
            chapters={adminContext.chapters}
            isSuperAdmin={adminContext.isSuperAdmin}
          />

          <SenderSection
            senderName={emailForm.senderName}
            setSenderName={emailForm.setSenderName}
            replyTo={emailForm.replyTo}
            setReplyTo={emailForm.setReplyTo}
            onOpenSettings={() => setShowPreferencesModal(true)}
          />

          <EmailContentForm
            selectedTemplate={emailForm.selectedTemplate}
            handleTemplateChange={emailForm.handleTemplateChange}
            subject={emailForm.subject}
            setSubject={emailForm.setSubject}
            content={emailForm.content}
            setContent={emailForm.setContent}
          />

          {/* Attachments */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Attachments
            </h3>
            <label
              className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-gray-300 transition-colors cursor-pointer block"
            >
              <input
                type="file"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const files = e.target.files
                  if (!files || files.length === 0) return
                  const fileArray = Array.from(files)
                  e.target.value = ''
                  emailAttachments.addFiles(fileArray)
                }}
              />
              <svg className="w-6 h-6 mx-auto text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
              <p className="text-sm text-gray-500">
                Drop files here or <span className="text-labor-red font-medium">browse</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                PDF, Word, Excel, PowerPoint, images, CSV, TXT (max 25MB each)
              </p>
            </label>

            {emailAttachments.attachments.length > 0 && (
              <div className="space-y-1.5">
                {emailAttachments.attachments.map((attachment) => (
                  <div
                    key={attachment.id}
                    className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                      attachment.error
                        ? 'bg-red-50 border border-red-100'
                        : 'bg-gray-50 border border-gray-100'
                    }`}
                  >
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      attachment.error
                        ? 'bg-red-100 text-red-600'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {attachment.filename?.split('.').pop()?.toUpperCase() || 'FILE'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 truncate text-xs">{attachment.filename}</p>
                      {attachment.error ? (
                        <p className="text-red-500 text-xs">{attachment.error}</p>
                      ) : attachment.uploading ? (
                        <p className="text-gray-400 text-xs">Uploading...</p>
                      ) : (
                        <p className="text-gray-400 text-xs">
                          {attachment.size < 1024 * 1024
                            ? `${(attachment.size / 1024).toFixed(1)} KB`
                            : `${(attachment.size / 1024 / 1024).toFixed(1)} MB`}
                        </p>
                      )}
                    </div>
                    {attachment.uploading && (
                      <svg className="animate-spin h-4 w-4 text-gray-400 shrink-0" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    )}
                    {!attachment.uploading && (
                      <button
                        type="button"
                        onClick={() => emailAttachments.removeFile(attachment.id)}
                        className="text-gray-400 hover:text-red-500 shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {emailAttachments.uploadedAttachments.length > 0 && (
              <button
                type="button"
                onClick={handleInsertAttachmentLinks}
                disabled={emailAttachments.isUploading}
                className="w-full text-sm py-1.5 px-3 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Insert download links into email ({emailAttachments.uploadedAttachments.length} file{emailAttachments.uploadedAttachments.length !== 1 ? 's' : ''})
              </button>
            )}
          </div>
        </EmailComposerLayout>
      </form>
    </>
  )
}
