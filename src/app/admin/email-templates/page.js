'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import EmailEditor from '@/components/EmailEditor'

const VARIABLE_DESCRIPTIONS = {
  name: 'Recipient\'s first name',
  email: 'Recipient\'s email address',
  event_name: 'Name of the event',
  event_date: 'Formatted event date (e.g., "Monday, January 15, 2024")',
  event_time: 'Formatted event time (e.g., "6:00 PM")',
  event_location: 'Event location address',
  rsvp_status: 'RSVP status text (e.g., "confirmed", "tentatively confirmed")',
  amount: 'Payment amount in dollars',
  date: 'Current date',
  payment_type: 'Type of payment (e.g., "one-time donation", "recurring membership dues")',
  update_payment_url: 'URL to update payment method',
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editedSubject, setEditedSubject] = useState('')
  const [editedContent, setEditedContent] = useState('')

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/admin/email-templates')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTemplates(data.templates || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template)
    setEditedSubject(template.subject)
    setEditedContent(template.html_content)
    setEditMode(false)
  }

  const handleSave = async () => {
    if (!selectedTemplate) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/email-templates/${selectedTemplate.template_key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: editedSubject,
          html_content: editedContent,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Update local state
      setTemplates(templates.map(t =>
        t.template_key === selectedTemplate.template_key ? data.template : t
      ))
      setSelectedTemplate(data.template)
      setEditMode(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEnabled = async (template) => {
    try {
      const res = await fetch(`/api/admin/email-templates/${template.template_key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !template.enabled }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setTemplates(templates.map(t =>
        t.template_key === template.template_key ? data.template : t
      ))
      if (selectedTemplate?.template_key === template.template_key) {
        setSelectedTemplate(data.template)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const getVariablesForTemplate = (template) => {
    try {
      return JSON.parse(template.variables) || []
    } catch {
      return []
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <Link href="/admin" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block">
        &larr; Back to Admin Dashboard
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl text-gray-900">Email Templates</h1>
        <p className="text-gray-600 mt-1">
          Customize automated email templates for signups, events, and payments.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template List */}
        <div className="lg:col-span-1">
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Templates</h2>
            <div className="space-y-2">
              {templates.map(template => (
                <button
                  key={template.template_key}
                  onClick={() => handleSelectTemplate(template)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedTemplate?.template_key === template.template_key
                      ? 'border-labor-red bg-red-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{template.name}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      template.enabled
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {template.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-1">{template.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Template Editor */}
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">{selectedTemplate.name}</h2>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedTemplate.enabled}
                      onChange={() => handleToggleEnabled(selectedTemplate)}
                      className="rounded border-gray-300 text-labor-red focus:ring-labor-red"
                    />
                    Enabled
                  </label>
                  {!editMode ? (
                    <button
                      onClick={() => setEditMode(true)}
                      className="btn-primary text-sm px-4 py-2"
                    >
                      Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditMode(false)
                          setEditedSubject(selectedTemplate.subject)
                          setEditedContent(selectedTemplate.html_content)
                        }}
                        className="btn-secondary text-sm px-4 py-2"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary text-sm px-4 py-2"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-500 mb-4">{selectedTemplate.description}</p>

              {/* Available Variables */}
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-blue-900 mb-2">Available Variables</h3>
                <div className="flex flex-wrap gap-2">
                  {getVariablesForTemplate(selectedTemplate).map(variable => (
                    <div
                      key={variable}
                      className="group relative"
                    >
                      <code className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm cursor-help">
                        {`{${variable}}`}
                      </code>
                      <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-10">
                        <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                          {VARIABLE_DESCRIPTIONS[variable] || variable}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject Line
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    className="input-field"
                  />
                ) : (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    {selectedTemplate.subject}
                  </div>
                )}
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Content
                </label>
                {editMode ? (
                  <EmailEditor
                    value={editedContent}
                    onChange={setEditedContent}
                  />
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 text-sm text-gray-500">
                      Preview
                    </div>
                    <div
                      className="p-4 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: selectedTemplate.html_content }}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card text-center py-12">
              <div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-500">Select a template to view and edit</p>
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-gray-900 mb-2">About Automated Emails</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li><strong>Welcome Email:</strong> Sent automatically when a new member signs up</li>
          <li><strong>RSVP Confirmation:</strong> Sent when members or guests RSVP to events</li>
          <li><strong>Event Reminders:</strong> Sent 24 hours and 1 hour before events</li>
          <li><strong>Payment Receipt:</strong> Sent after successful payments</li>
          <li><strong>Payment Failed:</strong> Sent when a recurring payment fails</li>
        </ul>
      </div>
    </div>
  )
}
