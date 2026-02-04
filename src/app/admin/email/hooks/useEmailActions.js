import { useState, useCallback } from 'react'

/**
 * Hook for handling test email and send email actions
 */
export function useEmailActions() {
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)
  const [emailSentInfo, setEmailSentInfo] = useState(null)

  const handleTestEmail = useCallback(async ({
    subject,
    content,
    testEmail,
    replyTo,
    senderName
  }) => {
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
      return { success: true }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setTestLoading(false)
    }
  }, [])

  const handleSendEmail = useCallback(async ({
    subject,
    content,
    recipientType,
    chapterId,
    groupId,
    replyTo,
    senderName
  }) => {
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
          chapterId: chapterId || undefined,
          groupId: groupId || undefined,
          replyTo: replyTo || undefined,
          senderName: senderName || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send email')
      }

      // Show success modal with recipient count
      setEmailSentInfo({ count: data.count || 1 })
      return { success: true, count: data.count }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    testLoading,
    success,
    setSuccess,
    error,
    setError,
    emailSentInfo,
    setEmailSentInfo,
    handleTestEmail,
    handleSendEmail
  }
}
