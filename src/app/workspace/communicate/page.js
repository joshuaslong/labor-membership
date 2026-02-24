'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAdminContext } from '@/app/admin/email/hooks/useAdminContext'
import { useEmailPreferences } from '@/app/admin/email/hooks/useEmailPreferences'
import { useEmailForm } from '@/app/admin/email/hooks/useEmailForm'
import { useRecipients } from '@/app/admin/email/hooks/useRecipients'
import { useEmailActions } from '@/app/admin/email/hooks/useEmailActions'
import { useEmailDraft } from '@/app/admin/email/hooks/useEmailDraft'
import { useEmailAttachments } from '@/app/admin/email/hooks/useEmailAttachments'
import { EMAIL_TEMPLATES } from '@/app/admin/email/utils/emailTemplates'

import EmailComposerLayout from '@/components/EmailComposerLayout'
import PreferencesModal from '@/app/admin/email/components/PreferencesModal'
import RecipientSelector from '@/app/admin/email/components/RecipientSelector'
import SenderSection from '@/app/admin/email/components/SenderSection'
import EmailContentForm from '@/app/admin/email/components/EmailContentForm'
import EmailAttachments from '@/app/admin/email/components/EmailAttachments'
import EmailPreview from '@/app/admin/email/components/EmailPreview'
import EmailActions from '@/app/admin/email/components/EmailActions'
import EmailSentModal from '@/app/admin/email/components/EmailSentModal'

function CommunicateContent() {
  const searchParams = useSearchParams()
  const templateParam = searchParams.get('template')
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

  // Apply template from URL param
  useEffect(() => {
    if (templateParam && EMAIL_TEMPLATES.some(t => t.id === templateParam)) {
      emailForm.handleTemplateChange(templateParam)
    }
  }, [templateParam, emailForm.handleTemplateChange])

  // Load draft on mount, or pre-populate from chapter switcher cookie
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
    } else {
      // No draft — pre-populate from chapter switcher if a chapter is selected
      const cookieMatch = document.cookie.match(/chapter_scope=([^;]+)/)
      const selectedChapter = cookieMatch?.[1]
      if (selectedChapter && selectedChapter !== 'all') {
        recipients.setRecipientType('specific_chapter')
        recipients.setSelectedChapterId(selectedChapter)
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
          <p className="text-sm mt-1">You do not have permission to send emails. Please contact your administrator.</p>
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
                <h1 className="text-xl font-semibold text-gray-900">Compose Email</h1>
                <p className="text-sm text-gray-500 mt-0.5">Send to members in your chapter</p>
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

          <EmailAttachments
            attachments={emailAttachments.attachments}
            uploadedAttachments={emailAttachments.uploadedAttachments}
            isUploading={emailAttachments.isUploading}
            onAddFiles={emailAttachments.addFiles}
            onRemoveFile={emailAttachments.removeFile}
            onInsertLinks={handleInsertAttachmentLinks}
          />
        </EmailComposerLayout>
      </form>
    </>
  )
}

export default function CommunicatePage() {
  return (
    <Suspense fallback={
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-stone-200 rounded w-1/4"></div>
          <div className="h-4 bg-stone-200 rounded w-1/2"></div>
          <div className="h-32 bg-stone-200 rounded"></div>
        </div>
      </div>
    }>
      <CommunicateContent />
    </Suspense>
  )
}
