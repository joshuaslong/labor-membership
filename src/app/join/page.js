'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function JoinForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedChapter = searchParams.get('chapter')

  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirm_password: '',
    phone: '',
    address_line1: '',
    city: '',
    state: '',
    zip_code: '',
    chapter_id: preselectedChapter || '',
  })

  useEffect(() => {
    const checkAuthAndLoadChapters = async () => {
      const supabase = createClient()

      // Check if user is already logged in
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Check if they have a member record
        const { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (member) {
          // Already a member, redirect to dashboard
          router.push('/dashboard')
          return
        }
      }

      setCheckingAuth(false)

      // Load chapters
      const res = await fetch('/api/chapters')
      const data = await res.json()
      setChapters(data.chapters || [])
    }

    checkAuthAndLoadChapters()
  }, [router])

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (form.password !== form.confirm_password) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'Failed to join')

      const supabase = createClient()
      await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })

      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const chaptersByLevel = chapters.reduce((acc, c) => {
    acc[c.level] = acc[c.level] || []
    acc[c.level].push(c)
    return acc
  }, {})

  // Show loading while checking auth
  if (checkingAuth) {
    return <div className="max-w-xl mx-auto px-4 py-12 text-center">Loading...</div>
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Join the Labor Party</h1>
      <p className="text-gray-600 mb-8">
        Become a member and join your local chapter.
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
            <input
              required
              className="input-field"
              value={form.first_name}
              onChange={e => updateField('first_name', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
            <input
              required
              className="input-field"
              value={form.last_name}
              onChange={e => updateField('last_name', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            type="email"
            required
            className="input-field"
            value={form.email}
            onChange={e => updateField('email', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <input
              type="password"
              required
              minLength={8}
              className="input-field"
              value={form.password}
              onChange={e => updateField('password', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
            <input
              type="password"
              required
              className="input-field"
              value={form.confirm_password}
              onChange={e => updateField('confirm_password', e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 -mt-2">Password must be at least 8 characters</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="tel"
            className="input-field"
            value={form.phone}
            onChange={e => updateField('phone', e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input
            className="input-field"
            placeholder="Street address"
            value={form.address_line1}
            onChange={e => updateField('address_line1', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              className="input-field"
              value={form.city}
              onChange={e => updateField('city', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <input
              className="input-field"
              maxLength={2}
              placeholder="PA"
              value={form.state}
              onChange={e => updateField('state', e.target.value.toUpperCase())}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
            <input
              className="input-field"
              value={form.zip_code}
              onChange={e => updateField('zip_code', e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Chapter *</label>
          <select
            required
            className="input-field"
            value={form.chapter_id}
            onChange={e => updateField('chapter_id', e.target.value)}
          >
            <option value="">Select a chapter...</option>
            {['national', 'state', 'county', 'city'].map(level => (
              chaptersByLevel[level]?.length > 0 && (
                <optgroup key={level} label={level.charAt(0).toUpperCase() + level.slice(1)}>
                  {chaptersByLevel[level].map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </optgroup>
              )
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Joining a local chapter automatically includes you in all parent chapters.
          </p>
        </div>

        <button type="submit" disabled={loading} className="w-full btn-primary py-3">
          {loading ? 'Creating account...' : 'Join Now'}
        </button>
      </form>

      <p className="mt-6 text-center text-gray-600">
        Already a member?{' '}
        <Link href="/login" className="text-labor-red hover:underline">Log in</Link>
      </p>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="max-w-xl mx-auto px-4 py-12 text-center">Loading...</div>}>
      <JoinForm />
    </Suspense>
  )
}
