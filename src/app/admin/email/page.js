'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAdminContext } from './hooks/useAdminContext'
import { useEmailPreferences } from './hooks/useEmailPreferences'
import { useEmailForm } from './hooks/useEmailForm'
import { useRecipients } from './hooks/useRecipients'
import { useEmailActions } from './hooks/useEmailActions'
import { useEmailDraft } from './hooks/useEmailDraft'
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
      recipients.setRecipientType('my_chapter')
      recipients.setSelectedChapterId('')
      recipients.setSelectedGroupId('')
    }
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
        </EmailComposerLayout>
      </form>
    </>
  )
}
