'use client'

import Link from 'next/link'
import { useAdminContext } from './hooks/useAdminContext'
import { useEmailPreferences } from './hooks/useEmailPreferences'
import { useEmailForm } from './hooks/useEmailForm'
import { useRecipients } from './hooks/useRecipients'
import { useEmailActions } from './hooks/useEmailActions'
import { EMAIL_TEMPLATES } from './utils/emailTemplates'

import EmailPreferences from './components/EmailPreferences'
import SignatureModal from './components/SignatureModal'
import RecipientSelector from './components/RecipientSelector'
import EmailContentForm from './components/EmailContentForm'
import EmailPreview from './components/EmailPreview'
import EmailActions from './components/EmailActions'
import EmailSentModal from './components/EmailSentModal'

export default function EmailComposePage() {
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

  // Loading state
  if (adminContext.loading || emailPrefs.isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    )
  }

  // Unauthorized
  if (!adminContext.adminInfo) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg">
          <p>You do not have permission to access this page.</p>
          <Link href="/admin" className="text-labor-red hover:underline">
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
      // Reset form
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
    <div className="max-w-4xl mx-auto px-0 sm:px-4 py-4 sm:py-8">
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
      <Link href="/admin" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block px-4 sm:px-0">
        ← Back to Admin
      </Link>

      <h1 className="text-2xl sm:text-3xl text-gray-900 mb-2 px-4 sm:px-0">Send Email</h1>
      <p className="text-gray-600 mb-6 sm:mb-8 px-4 sm:px-0">
        Compose and send emails to members.
      </p>

      {/* Success/Error Messages */}
      {actions.success && (
        <div className="bg-green-50 text-green-700 p-4 mx-4 sm:mx-0 rounded-lg mb-6 flex justify-between items-center">
          <span>{actions.success}</span>
          <button onClick={() => actions.setSuccess(null)} className="text-green-600 hover:text-green-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {actions.error && (
        <div className="bg-red-50 text-red-700 p-4 mx-4 sm:mx-0 rounded-lg mb-6 flex justify-between items-center">
          <span>{actions.error}</span>
          <button onClick={() => actions.setError(null)} className="text-red-600 hover:text-red-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {recipients.error && (
        <div className="bg-red-50 text-red-700 p-4 mx-4 sm:mx-0 rounded-lg mb-6 flex justify-between items-center">
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
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
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
          onSendEmail={() => {}} // Handled by form onSubmit
          loading={actions.loading}
          canSend={recipients.isValid() && emailForm.subject && emailForm.content}
          subject={emailForm.subject}
          content={emailForm.content}
        />
      </form>
    </div>
  )
}
