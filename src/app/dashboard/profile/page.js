'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ProfilePage() {
  const router = useRouter()
  const [member, setMember] = useState(null)
  const [chapters, setChapters] = useState([])
  const [memberChapters, setMemberChapters] = useState([])
  const [selectedChapter, setSelectedChapter] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingChapter, setSavingChapter] = useState(false)
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
        setSelectedChapter(data.chapter_id || '')

        // Load member's chapter memberships
        const { data: mcData } = await supabase
          .from('member_chapters')
          .select('chapter_id, is_primary, chapters(id, name, level)')
          .eq('member_id', data.id)
        setMemberChapters(mcData || [])
      }

      // Load all chapters
      const { data: chaptersData } = await supabase
        .from('chapters')
        .select('id, name, level')
        .order('level')
        .order('name')
      setChapters(chaptersData || [])

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
        wants_to_volunteer: member.wants_to_volunteer,
        volunteer_interests: member.volunteer_interests,
        volunteer_skills: member.volunteer_skills,
        mailing_list_opted_in: member.mailing_list_opted_in,
      })
      .eq('id', member.id)

    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    setSaving(false)
  }

  const handleChapterChange = async () => {
    if (!selectedChapter || selectedChapter === member.chapter_id) return

    setSavingChapter(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/members/${member.id}/chapter`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapter_id: selectedChapter }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update chapter')
      }

      // Reload member chapters
      const supabase = createClient()
      const { data: mcData } = await supabase
        .from('member_chapters')
        .select('chapter_id, is_primary, chapters(id, name, level)')
        .eq('member_id', member.id)

      setMemberChapters(mcData || [])
      setMember({ ...member, chapter_id: selectedChapter })
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    }

    setSavingChapter(false)
  }

  // Group chapters by level
  const chaptersByLevel = chapters.reduce((acc, c) => {
    acc[c.level] = acc[c.level] || []
    acc[c.level].push(c)
    return acc
  }, {})

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
      <p className="text-gray-600 mb-8">Update your contact information and preferences.</p>

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

        {/* Chapter */}
        <div className="border-t border-gray-200 pt-4 mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Chapter</label>
          <div className="flex gap-3">
            <select
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              className="input-field flex-1"
            >
              <option value="">No chapter selected</option>
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
            <button
              type="button"
              onClick={handleChapterChange}
              disabled={savingChapter || selectedChapter === member.chapter_id}
              className="btn-secondary px-4"
            >
              {savingChapter ? 'Updating...' : 'Update'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Joining a local chapter automatically includes you in all parent chapters.
          </p>
          {memberChapters.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {memberChapters
                .sort((a, b) => {
                  const order = ['national', 'state', 'county', 'city']
                  return order.indexOf(a.chapters?.level) - order.indexOf(b.chapters?.level)
                })
                .map(mc => (
                  <span
                    key={mc.chapter_id}
                    className={`px-2 py-1 rounded text-xs ${
                      mc.is_primary
                        ? 'bg-labor-red text-white'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {mc.chapters?.name}
                    {mc.is_primary && ' (primary)'}
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Volunteer */}
        <div className="border-t border-gray-200 pt-4 mt-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-labor-red focus:ring-labor-red"
              checked={member.wants_to_volunteer || false}
              onChange={(e) => setMember({ ...member, wants_to_volunteer: e.target.checked })}
            />
            <div>
              <span className="text-sm font-medium text-gray-900">I want to volunteer</span>
              <p className="text-xs text-gray-500">Help with events, outreach, or other organizing work</p>
            </div>
          </label>
          {member.wants_to_volunteer && (
            <div className="mt-3 ml-7 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What kind of work interests you?</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="e.g., door knocking, phone banking, event planning, social media..."
                  value={member.volunteer_interests || ''}
                  onChange={(e) => setMember({ ...member, volunteer_interests: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">What skills or experience do you have?</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder="e.g., graphic design, web development, legal, healthcare, union organizing, teaching..."
                  value={member.volunteer_skills || ''}
                  onChange={(e) => setMember({ ...member, volunteer_skills: e.target.value })}
                />
                <p className="text-xs text-gray-500 mt-1">Help us match you with the right opportunities</p>
              </div>
            </div>
          )}
        </div>

        {/* Mailing list */}
        <div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-labor-red focus:ring-labor-red"
              checked={member.mailing_list_opted_in !== false}
              onChange={(e) => setMember({ ...member, mailing_list_opted_in: e.target.checked })}
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Keep me updated</span>
              <p className="text-xs text-gray-500">Receive news, updates, and action alerts via email</p>
            </div>
          </label>
        </div>

        <button type="submit" disabled={saving} className="w-full btn-primary py-3">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
