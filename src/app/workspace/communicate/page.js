'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAdminContext } from '@/app/admin/email/hooks/useAdminContext'
import { useEmailPreferences } from '@/app/admin/email/hooks/useEmailPreferences'
import { useEmailForm } from '@/app/admin/email/hooks/useEmailForm'
import { useRecipients } from '@/app/admin/email/hooks/useRecipients'
import { useEmailActions } from '@/app/admin/email/hooks/useEmailActions'
import { useEmailDraft } from '@/app/admin/email/hooks/useEmailDraft'
import { EMAIL_TEMPLATES } from '@/app/admin/email/utils/emailTemplates'

import EmailPreferences from '@/app/admin/email/components/EmailPreferences'
import SignatureModal from '@/app/admin/email/components/SignatureModal'
import RecipientSelector from '@/app/admin/email/components/RecipientSelector'
import EmailContentForm from '@/app/admin/email/components/EmailContentForm'
import EmailPreview from '@/app/admin/email/components/EmailPreview'
import EmailActions from '@/app/admin/email/components/EmailActions'
import EmailSentModal from '@/app/admin/email/components/EmailSentModal'

function CommunicateContent() {
  const searchParams = useSearchParams()
  const templateParam = searchParams.get('template')

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
    groupChapterId: recipients.groupChapterId
  })

  // Apply template from URL param
  useEffect(() => {
    if (templateParam && EMAIL_TEMPLATES.some(t => t.id === templateParam)) {
      emailForm.handleTemplateChange(templateParam)
    }
  }, [templateParam])

  // Load draft on mount
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

  return (
    <div className="p-6 max-w-4xl">
      {/* Modals */}
      <EmailSentModal
        emailSentInfo={actions.emailSentInfo}
        onClose={() => actions.setEmailSentInfo(null)}
      />
      <SignatureModal
        show={emailPrefs.showSignatureModal}
        signature={emailPrefs.modalSignature}
        setSignature={emailPrefs.setModalSignature}
        onSave={emailPrefs.handleSaveSignature}
        onClose={() => emailPrefs.setShowSignatureModal(false)}
        saving={emailPrefs.savingPreferences}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-gray-900">Compose Email</h1>
        {draft.lastSaved && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              Draft saved {new Date(draft.lastSaved).toLocaleTimeString()}
            </span>
            <button
              type="button"
              onClick={() => {
                if (confirm('Clear draft? This will reset the form to defaults.')) {
                  draft.clearDraft()
                  emailForm.resetForm()
                  recipients.setRecipientType('my_chapter')
                  recipients.setSelectedChapterId('')
                  recipients.setSelectedGroupId('')
                }
              }}
              className="text-xs text-gray-500 hover:text-red-600 underline"
            >
              Clear Draft
            </button>
          </div>
        )}
      </div>
      <p className="text-gray-600 mb-6">
        Send emails to members in your chapter. Your draft is automatically saved.
      </p>

      {/* Success/Error Messages */}
      {actions.success && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 flex justify-between items-center">
          <span>{actions.success}</span>
          <button onClick={() => actions.setSuccess(null)} className="text-green-600 hover:text-green-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {actions.error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex justify-between items-center">
          <span>{actions.error}</span>
          <button onClick={() => actions.setError(null)} className="text-red-600 hover:text-red-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {recipients.error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex justify-between items-center">
          <span>{recipients.error}</span>
          <button onClick={() => recipients.setError(null)} className="text-red-600 hover:text-red-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Preferences Section */}
      <EmailPreferences
        preferences={emailPrefs.preferences}
        setPreferences={emailPrefs.setPreferences}
        showPreferences={emailPrefs.showPreferences}
        setShowPreferences={emailPrefs.setShowPreferences}
        savingPreferences={emailPrefs.savingPreferences}
        handleSavePreferences={emailPrefs.handleSavePreferences}
        handleOpenSignatureModal={emailPrefs.handleOpenSignatureModal}
      />

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
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

        <EmailContentForm
          selectedTemplate={emailForm.selectedTemplate}
          handleTemplateChange={emailForm.handleTemplateChange}
          senderName={emailForm.senderName}
          setSenderName={emailForm.setSenderName}
          replyTo={emailForm.replyTo}
          setReplyTo={emailForm.setReplyTo}
          subject={emailForm.subject}
          setSubject={emailForm.setSubject}
          content={emailForm.content}
          setContent={emailForm.setContent}
          preferences={emailPrefs.preferences}
        />

        <EmailPreview
          subject={emailForm.subject}
          content={emailForm.content}
          senderName={emailForm.senderName}
          replyTo={emailForm.replyTo}
          signature={emailPrefs.preferences.default_signature}
        />

        <EmailActions
          testEmail={emailForm.testEmail}
          setTestEmail={emailForm.setTestEmail}
          onTestEmail={handleTestEmail}
          testLoading={actions.testLoading}
          onSendEmail={() => {}}
          loading={actions.loading}
          canSend={recipients.isValid() && emailForm.subject && emailForm.content}
          subject={emailForm.subject}
          content={emailForm.content}
        />
      </form>
    </div>
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
