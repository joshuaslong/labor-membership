'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ProfilePage() {
  const router = useRouter()
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('members')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setMember(data)
      }
      setLoading(false)
    }

    loadProfile()
  }, [router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    const supabase = createClient()
    const { error } = await supabase
      .from('members')
      .update({
        phone: member.phone,
        address_line1: member.address_line1,
        city: member.city,
        state: member.state,
        zip_code: member.zip_code,
      })
      .eq('id', member.id)

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="max-w-xl mx-auto px-4 py-12 text-center">Loading...</div>
  }

  if (!member) {
    return <div className="max-w-xl mx-auto px-4 py-12 text-center">Profile not found</div>
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm mb-4 inline-block">
        &larr; Back to Dashboard
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Profile</h1>
      <p className="text-gray-600 mb-8">Update your contact information.</p>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6">Profile updated!</div>}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input className="input-field bg-gray-50" value={member.first_name} disabled />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input className="input-field bg-gray-50" value={member.last_name} disabled />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input className="input-field bg-gray-50" value={member.email} disabled />
          <p className="text-xs text-gray-500 mt-1">Contact support to change your email.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="tel"
            className="input-field"
            value={member.phone || ''}
            onChange={(e) => setMember({ ...member, phone: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input
            className="input-field"
            value={member.address_line1 || ''}
            onChange={(e) => setMember({ ...member, address_line1: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
            <input
              className="input-field"
              value={member.city || ''}
              onChange={(e) => setMember({ ...member, city: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <input
              className="input-field"
              maxLength={2}
              value={member.state || ''}
              onChange={(e) => setMember({ ...member, state: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
            <input
              className="input-field"
              value={member.zip_code || ''}
              onChange={(e) => setMember({ ...member, zip_code: e.target.value })}
            />
          </div>
        </div>

        <button type="submit" disabled={saving} className="w-full btn-primary py-3">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
