import { useEffect, useRef, useCallback, useState } from 'react'

const DRAFT_KEY = 'email_composer_draft'
const AUTOSAVE_DELAY = 2000 // 2 seconds after last change

/**
 * Hook for auto-saving email drafts to localStorage
 * Saves draft state with debouncing to avoid excessive writes
 */
export function useEmailDraft({
  subject,
  content,
  senderName,
  replyTo,
  selectedTemplate,
  testEmail,
  recipientType,
  selectedChapterId,
  selectedGroupId,
  groupChapterId
}) {
  const [lastSaved, setLastSaved] = useState(null)
  const [isDraftLoaded, setIsDraftLoaded] = useState(false)
  const autosaveTimerRef = useRef(null)

  // Load draft from localStorage on mount
  const loadDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const draft = JSON.parse(saved)
        setLastSaved(draft.savedAt ? new Date(draft.savedAt) : null)
        setIsDraftLoaded(true)
        return draft
      }
    } catch (error) {
      console.error('Failed to load draft:', error)
    }
    setIsDraftLoaded(true)
    return null
  }, [])

  // Save draft to localStorage
  const saveDraft = useCallback(() => {
    // Don't save empty drafts
    if (!subject && !content) {
      return
    }

    try {
      const draft = {
        subject,
        content,
        senderName,
        replyTo,
        selectedTemplate,
        testEmail,
        recipientType,
        selectedChapterId,
        selectedGroupId,
        groupChapterId,
        savedAt: new Date().toISOString()
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      setLastSaved(new Date())
    } catch (error) {
      console.error('Failed to save draft:', error)
    }
  }, [subject, content, senderName, replyTo, selectedTemplate, testEmail, recipientType, selectedChapterId, selectedGroupId, groupChapterId])

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_KEY)
      setLastSaved(null)
    } catch (error) {
      console.error('Failed to clear draft:', error)
    }
  }, [])

  // Auto-save with debouncing
  useEffect(() => {
    // Skip if draft hasn't been loaded yet (initial mount)
    if (!isDraftLoaded) return

    // Clear existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current)
    }

    // Set new timer to save after delay
    autosaveTimerRef.current = setTimeout(() => {
      saveDraft()
    }, AUTOSAVE_DELAY)

    // Cleanup on unmount or when dependencies change
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [subject, content, senderName, replyTo, selectedTemplate, testEmail, recipientType, selectedChapterId, selectedGroupId, groupChapterId, saveDraft, isDraftLoaded])

  return {
    loadDraft,
    clearDraft,
    lastSaved,
    isDraftLoaded
  }
}
