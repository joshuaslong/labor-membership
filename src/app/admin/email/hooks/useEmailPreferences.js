import { useState, useEffect } from 'react'
import { applySignature } from '../utils/emailTemplates'

/**
 * Hook for managing email preferences (reply-to, signature)
 */
export function useEmailPreferences(adminEmail, setReplyTo, setContent, EMAIL_TEMPLATES) {
  const [preferences, setPreferences] = useState({ default_reply_to: '', default_signature: '' })
  const [showPreferences, setShowPreferences] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [modalSignature, setModalSignature] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const prefsRes = await fetch('/api/admin/preferences')
        if (prefsRes.ok) {
          const prefsData = await prefsRes.json()
          if (prefsData.preferences) {
            setPreferences(prefsData.preferences)
            // Use saved reply-to if available, otherwise default to admin email
            setReplyTo(prefsData.preferences.default_reply_to || adminEmail || '')
            // Apply signature to initial template content
            const initialContent = EMAIL_TEMPLATES[0].content
            const contentWithSignature = applySignature(initialContent, prefsData.preferences.default_signature)
            setContent(contentWithSignature)
          }
        } else {
          console.warn('Failed to load preferences:', await prefsRes.text())
          setError('Could not load email preferences. Using defaults.')
        }
      } catch (err) {
        console.error('Error loading preferences:', err)
        setError('Failed to load email preferences. Using defaults.')
        // Fall back to admin email
        if (adminEmail) {
          setReplyTo(adminEmail)
        }
      } finally {
        setIsLoading(false)
      }
    }

    if (adminEmail) {
      loadPreferences()
    }
  }, [adminEmail, setReplyTo, setContent, EMAIL_TEMPLATES])

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

      // Apply the new reply-to immediately
      if (preferences.default_reply_to) {
        setReplyTo(preferences.default_reply_to)
      }

      return { success: true }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setSavingPreferences(false)
    }
  }

  const handleOpenSignatureModal = () => {
    setModalSignature(preferences.default_signature || '')
    setShowSignatureModal(true)
  }

  const handleSaveSignature = async () => {
    setSavingPreferences(true)
    setError(null)

    try {
      const prefsToSave = {
        ...preferences,
        default_signature: modalSignature
      }

      const res = await fetch('/api/admin/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefsToSave),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setPreferences(prefsToSave)
      setShowSignatureModal(false)

      // Re-apply signature to current template to pick up changes
      // This only works if content still has {$SIGNATURE} marker
      setContent(prevContent => {
        // Only apply if marker exists (template hasn't been heavily customized)
        if (prevContent.includes('{$SIGNATURE}')) {
          return applySignature(prevContent, modalSignature)
        }
        return prevContent
      })

      return { success: true }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setSavingPreferences(false)
    }
  }

  return {
    preferences,
    setPreferences,
    showPreferences,
    setShowPreferences,
    showSignatureModal,
    setShowSignatureModal,
    modalSignature,
    setModalSignature,
    savingPreferences,
    handleSavePreferences,
    handleOpenSignatureModal,
    handleSaveSignature,
    isLoading,
    error
  }
}
