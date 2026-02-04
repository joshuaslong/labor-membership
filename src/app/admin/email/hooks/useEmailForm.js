import { useState, useCallback } from 'react'
import { EMAIL_TEMPLATES, applySignature } from '../utils/emailTemplates'

/**
 * Hook for managing email composition form state
 */
export function useEmailForm(defaultSignature, adminEmail) {
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState(EMAIL_TEMPLATES[0].content)
  const [senderName, setSenderName] = useState('Labor Party')
  const [replyTo, setReplyTo] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('announcement')
  const [testEmail, setTestEmail] = useState('')

  const handleTemplateChange = useCallback((templateId) => {
    setSelectedTemplate(templateId)
    const template = EMAIL_TEMPLATES.find(t => t.id === templateId)
    if (template) {
      setSubject(template.subject)
      // Apply signature (custom or default) to template
      const contentWithSignature = applySignature(template.content, defaultSignature)
      setContent(contentWithSignature)
    }
  }, [defaultSignature])

  const resetForm = useCallback(() => {
    setSubject('')
    setContent(EMAIL_TEMPLATES[0].content)
    setSelectedTemplate('announcement')
    setReplyTo(adminEmail || '')
  }, [adminEmail])

  return {
    subject,
    setSubject,
    content,
    setContent,
    senderName,
    setSenderName,
    replyTo,
    setReplyTo,
    selectedTemplate,
    testEmail,
    setTestEmail,
    handleTemplateChange,
    resetForm
  }
}
