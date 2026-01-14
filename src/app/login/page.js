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
      // If invalid credentials, suggest magic link for migrated members
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
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="card text-center">
          <div className="text-4xl mb-4">✉️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check Your Email</h1>
          <p className="text-gray-600 mb-4">
            We sent a magic link to <strong>{email}</strong>
          </p>
          <p className="text-sm text-gray-500">
            Click the link in your email to log in. The link expires in 1 hour.
          </p>
          <button
            onClick={() => { setMagicLinkSent(false); setShowMagicLink(false) }}
            className="mt-6 text-red-700 hover:underline text-sm"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Log In</h1>
      <p className="text-gray-600 mb-8">
        Access your member account or admin dashboard.
      </p>

      {message && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6">{message}</div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">{error}</div>
      )}

      <form onSubmit={handleLogin} className="card space-y-4">
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            required
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading} className="w-full btn-primary py-3">
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </form>

      {showMagicLink && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800 mb-3">
            <strong>Migrated from our old platform?</strong> Get a magic link sent to your email:
          </p>
          <button
            onClick={handleMagicLink}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Magic Link'}
          </button>
        </div>
      )}

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => setShowMagicLink(!showMagicLink)}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          {showMagicLink ? 'Hide magic link option' : 'Log in with magic link instead'}
        </button>
      </div>

      <p className="mt-4 text-center text-gray-600">
        Not a member yet?{' '}
        <Link href="/join" className="text-labor-red hover:underline">Join now</Link>
      </p>
      <p className="mt-2 text-center">
        <Link href="/forgot-password" className="text-gray-500 hover:text-gray-700 text-sm">
          Forgot your password?
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto px-4 py-12 text-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  )
}
