'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Suspense } from 'react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const message = searchParams.get('message')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [showMagicLink, setShowMagicLink] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. If you were a member before our platform update, use the magic link option below.')
        setShowMagicLink(true)
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  const handleMagicLink = async (e) => {
    e.preventDefault()
    if (!email) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setMagicLinkSent(true)
    setLoading(false)
  }

  if (magicLinkSent) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="card text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-labor-red-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-labor-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Check your email</h1>
            <p className="mt-2 text-gray-600">
              We sent a magic link to <span className="font-medium text-gray-900">{email}</span>
            </p>
            <p className="mt-4 text-sm text-gray-500">
              Click the link in your email to log in. The link expires in 1 hour.
            </p>
            <button
              onClick={() => { setMagicLinkSent(false); setShowMagicLink(false) }}
              className="mt-6 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Use a different email
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Welcome back</h1>
          <p className="mt-2 text-gray-500">
            Log in to your member account
          </p>
        </div>

        {/* Messages */}
        {message && (
          <div className="mb-6 p-4 rounded-md bg-green-50 border border-green-200">
            <p className="text-sm text-green-700">{message}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-md bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <div className="card">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="input-label">Email</label>
              <input
                type="email"
                required
                className="input-field"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="input-label mb-0">Password</label>
                <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                required
                className="input-field"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading} className="w-full btn-primary py-3">
              {loading ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-3 text-gray-500">or</span>
            </div>
          </div>

          {/* Magic Link */}
          <button
            type="button"
            onClick={handleMagicLink}
            disabled={loading || !email}
            className="w-full btn-secondary py-3"
          >
            {loading ? 'Sending...' : 'Send magic link'}
          </button>
          <p className="mt-2 text-center text-xs text-gray-400">
            We'll email you a link to log in without a password
          </p>
        </div>

        {/* Sign up link */}
        <p className="mt-8 text-center text-sm text-gray-500">
          Not a member yet?{' '}
          <Link href="/join" className="font-medium text-labor-red hover:text-labor-red-600 transition-colors">
            Join now
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
