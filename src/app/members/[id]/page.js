'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const STATUS_BADGES = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  lapsed: 'bg-orange-100 text-orange-800',
  cancelled: 'bg-red-100 text-red-800',
}

const LEVEL_COLORS = {
  national: 'bg-labor-red text-white',
  state: 'bg-blue-600 text-white',
  county: 'bg-green-600 text-white',
  city: 'bg-purple-600 text-white',
}

export default function MemberDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [member, setMember] = useState(null)
  const [chapters, setChapters] = useState([])
  const [memberChapters, setMemberChapters] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [selectedChapter, setSelectedChapter] = useState('')

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      // Check if current user is admin
      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (!adminUser) {
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)

      // Load member details
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('*, chapters(id, name, level)')
        .eq('id', params.id)
        .single()

      if (memberError || !memberData) {
        setError('Member not found')
        setLoading(false)
        return
      }

      setMember(memberData)
      setSelectedChapter(memberData.chapter_id || '')

      // Load all chapters for the dropdown
      const { data: chaptersData } = await supabase
        .from('chapters')
        .select('id, name, level, parent_id')
        .order('level')
        .order('name')

      setChapters(chaptersData || [])

      // Load member's chapter memberships from junction table
      const { data: mcData } = await supabase
        .from('member_chapters')
        .select('chapter_id, is_primary, chapters(id, name, level)')
        .eq('member_id', params.id)

      setMemberChapters(mcData || [])
      setLoading(false)
    }

    loadData()
  }, [params.id, router])

  const handleChapterChange = async () => {
    if (!selectedChapter || selectedChapter === member.chapter_id) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    // Use API to update chapter (handles member_chapters junction table)
    const res = await fetch(`/api/members/${member.id}/chapter`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chapter_id: selectedChapter }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to update chapter')
      setSaving(false)
      return
    }

    // Reload member chapters
    const supabase = createClient()
    const { data: mcData } = await supabase
      .from('member_chapters')
      .select('chapter_id, is_primary, chapters(id, name, level)')
      .eq('member_id', params.id)

    setMemberChapters(mcData || [])
    setMember({ ...member, chapter_id: selectedChapter })
    setSuccess('Chapter updated successfully')
    setSaving(false)
  }

  const handleStatusChange = async (newStatus) => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    const supabase = createClient()
    const { error: updateError } = await supabase
      .from('members')
      .update({ status: newStatus })
      .eq('id', member.id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setMember({ ...member, status: newStatus })
      setSuccess('Status updated successfully')
    }
    setSaving(false)
  }

  // Group chapters by level for easier selection
  const groupedChapters = chapters.reduce((acc, c) => {
    if (!acc[c.level]) acc[c.level] = []
    acc[c.level].push(c)
    return acc
  }, {})

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-12 text-center">Loading...</div>
  }

  if (error && !member) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href="/members" className="text-labor-red hover:underline">Back to Members</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/members" className="text-gray-500 hover:text-gray-700 text-sm mb-4 inline-block">
        &larr; Back to Members
      </Link>

      {error && <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6">{success}</div>}

      <div className="card mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {member.first_name} {member.last_name}
            </h1>
            <p className="text-gray-600">{member.email}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_BADGES[member.status]}`}>
            {member.status}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Contact Information</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex">
                <dt className="w-24 text-gray-500">Phone:</dt>
                <dd className="text-gray-900">{member.phone || '-'}</dd>
              </div>
              <div className="flex">
                <dt className="w-24 text-gray-500">Address:</dt>
                <dd className="text-gray-900">{member.address_line1 || '-'}</dd>
              </div>
              <div className="flex">
                <dt className="w-24 text-gray-500">City:</dt>
                <dd className="text-gray-900">{member.city || '-'}</dd>
              </div>
              <div className="flex">
                <dt className="w-24 text-gray-500">State:</dt>
                <dd className="text-gray-900">{member.state || '-'}</dd>
              </div>
              <div className="flex">
                <dt className="w-24 text-gray-500">ZIP:</dt>
                <dd className="text-gray-900">{member.zip_code || '-'}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-3">Membership Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex">
                <dt className="w-24 text-gray-500">Joined:</dt>
                <dd className="text-gray-900">{new Date(member.joined_date).toLocaleDateString()}</dd>
              </div>
              {member.bio && (
                <div className="flex">
                  <dt className="w-24 text-gray-500">Bio:</dt>
                  <dd className="text-gray-900">{member.bio}</dd>
                </div>
              )}
              <div className="flex">
                <dt className="w-24 text-gray-500">Volunteer:</dt>
                <dd className="text-gray-900">{member.wants_to_volunteer ? 'Yes' : 'No'}</dd>
              </div>
              {member.volunteer_details && (
                <div className="flex">
                  <dt className="w-24 text-gray-500">Details:</dt>
                  <dd className="text-gray-900">{member.volunteer_details}</dd>
                </div>
              )}
              <div className="flex">
                <dt className="w-24 text-gray-500">Mailing:</dt>
                <dd className="text-gray-900">{member.mailing_list_opted_in ? 'Opted In' : 'Opted Out'}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Chapter Assignment */}
      <div className="card mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Chapter Assignment</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Primary Chapter</label>
          <div className="flex gap-3">
            <select
              value={selectedChapter}
              onChange={(e) => setSelectedChapter(e.target.value)}
              className="input-field flex-1"
            >
              <option value="">No chapter assigned</option>
              {['national', 'state', 'county', 'city'].map(level => (
                groupedChapters[level]?.length > 0 && (
                  <optgroup key={level} label={level.charAt(0).toUpperCase() + level.slice(1)}>
                    {groupedChapters[level].map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                )
              ))}
            </select>
            <button
              onClick={handleChapterChange}
              disabled={saving || selectedChapter === member.chapter_id}
              className="btn-primary"
            >
              {saving ? 'Saving...' : 'Update'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Changing the primary chapter will automatically update all inherited chapter memberships.
          </p>
        </div>

        {memberChapters.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">All Chapter Memberships</h3>
            <div className="flex flex-wrap gap-2">
              {memberChapters
                .sort((a, b) => {
                  const order = ['national', 'state', 'county', 'city']
                  return order.indexOf(a.chapters?.level) - order.indexOf(b.chapters?.level)
                })
                .map(mc => (
                  <span
                    key={mc.chapter_id}
                    className={`px-3 py-1 rounded text-sm ${LEVEL_COLORS[mc.chapters?.level] || 'bg-gray-200'}`}
                  >
                    {mc.chapters?.name}
                    {mc.is_primary && <span className="ml-1 opacity-75">(primary)</span>}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Status Management */}
      <div className="card">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Status Management</h2>
        <div className="flex flex-wrap gap-2">
          {['pending', 'active', 'lapsed', 'cancelled'].map(status => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              disabled={saving || member.status === status}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                member.status === status
                  ? STATUS_BADGES[status]
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
