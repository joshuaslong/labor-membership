'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function EmailHistoryPage() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchEmailHistory = async () => {
      try {
        const supabase = createClient()

        // Try to fetch from email_logs (manual sends) first
        const { data: manualLogs, error: manualError } = await supabase
          .from('email_logs')
          .select(`
            id,
            subject,
            recipient_type,
            recipient_count,
            skipped_count,
            status,
            created_at,
            chapters(name)
          `)
          .order('created_at', { ascending: false })
          .limit(50)

        if (!manualError && manualLogs) {
          setLogs(manualLogs.map(log => ({
            ...log,
            type: 'broadcast',
            chapter_name: log.chapters?.name
          })))
        } else {
          // If email_logs doesn't exist, show message
          setLogs([])
        }
      } catch (err) {
        console.error('Error fetching email history:', err)
        setError('Failed to load email history')
      } finally {
        setLoading(false)
      }
    }

    fetchEmailHistory()
  }, [])

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRecipientTypeLabel = (type) => {
    const labels = {
      'my_chapter': 'My Chapter',
      'chapter': 'Specific Chapter',
      'group': 'Group',
      'all_members': 'All Members',
      'mailing_list': 'Mailing List'
    }
    return labels[type] || type
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-stone-200 rounded w-1/4"></div>
          <div className="h-4 bg-stone-200 rounded w-1/2"></div>
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-stone-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Sent Emails</h1>
      <p className="text-gray-600 mb-6">
        View history of emails sent from your account.
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {logs.length === 0 ? (
        <div className="bg-stone-50 rounded-lg p-8 text-center">
          <svg className="w-12 h-12 text-stone-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-600">No emails sent yet.</p>
          <p className="text-sm text-gray-500 mt-1">
            Emails you send will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recipients
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sent To
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {log.subject}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {log.recipient_count} sent
                      {log.skipped_count > 0 && (
                        <span className="text-gray-500 ml-1">
                          ({log.skipped_count} skipped)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {getRecipientTypeLabel(log.recipient_type)}
                      {log.chapter_name && (
                        <span className="text-gray-500 ml-1">
                          - {log.chapter_name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      log.status === 'sent'
                        ? 'bg-green-100 text-green-800'
                        : log.status === 'failed'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
