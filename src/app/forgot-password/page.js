'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="card">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Check Your Email</h1>
          <p className="text-gray-600 mb-6">
            We sent a password reset link to <strong>{email}</strong>
          </p>
          <Link href="/login" className="btn-secondary">Back to Login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Reset Password</h1>
      <p className="text-gray-600 mb-8">
        Enter your email and we'll send you a reset link.
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            required
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading} className="w-full btn-primary py-3">
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="mt-6 text-center">
        <Link href="/login" className="text-gray-500 hover:text-gray-700 text-sm">
          Back to Login
        </Link>
      </p>
    </div>
  )
}
