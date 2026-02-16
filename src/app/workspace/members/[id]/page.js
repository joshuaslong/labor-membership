'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ChapterSelect from '@/components/ChapterSelect'

const statusBadgeColor = {
  pending: 'text-amber-700 bg-amber-50 border-amber-200',
  active: 'text-green-700 bg-green-50 border-green-200',
  lapsed: 'text-orange-700 bg-orange-50 border-orange-200',
  cancelled: 'text-red-700 bg-red-50 border-red-200',
}

const levelBadgeColor = {
  national: 'text-red-700 bg-red-50 border-red-200',
  state: 'text-blue-700 bg-blue-50 border-blue-200',
  county: 'text-green-700 bg-green-50 border-green-200',
  city: 'text-amber-700 bg-amber-50 border-amber-200',
}

const roleBadgeColor = {
  super_admin: 'text-purple-700 bg-purple-50 border-purple-200',
  national_admin: 'text-red-700 bg-red-50 border-red-200',
  state_admin: 'text-blue-700 bg-blue-50 border-blue-200',
  county_admin: 'text-green-700 bg-green-50 border-green-200',
  city_admin: 'text-amber-700 bg-amber-50 border-amber-200',
}

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  national_admin: 'National Admin',
  state_admin: 'State Admin',
  county_admin: 'County Admin',
  city_admin: 'City Admin',
}

export default function MemberDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [member, setMember] = useState(null)
  const [chapters, setChapters] = useState([])
  const [memberChapters, setMemberChapters] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserRoles, setCurrentUserRoles] = useState([])
  const [memberAdminRecords, setMemberAdminRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [selectedChapter, setSelectedChapter] = useState('')
  const [selectedAdminChapter, setSelectedAdminChapter] = useState('')
  const [adminChapterSearch, setAdminChapterSearch] = useState('')
  const [showAdminChapterDropdown, setShowAdminChapterDropdown] = useState(false)
  const adminChapterDropdownRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (adminChapterDropdownRef.current && !adminChapterDropdownRef.current.contains(event.target)) {
        setShowAdminChapterDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: adminUsers } = await supabase
        .from('admin_users')
        .select('role, chapter_id')
        .eq('user_id', user.id)

      if (!adminUsers || adminUsers.length === 0) {
        router.push('/dashboard')
        return
      }

      setIsAdmin(true)
      setCurrentUserRoles(adminUsers.map(a => a.role))

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

      const { data: chaptersData } = await supabase
        .from('chapters')
        .select('id, name, level, parent_id')
        .order('level')
        .order('name')

      setChapters(chaptersData || [])

      const { data: mcData } = await supabase
        .from('member_chapters')
        .select('chapter_id, is_primary, chapters(id, name, level)')
        .eq('member_id', params.id)

      setMemberChapters(mcData || [])

      if (memberData.user_id) {
        const { data: memberAdmins } = await supabase
          .from('admin_users')
          .select('id, role, chapter_id, chapters(id, name, level)')
          .eq('user_id', memberData.user_id)
          .order('created_at', { ascending: false })

        if (memberAdmins && memberAdmins.length > 0) {
          setMemberAdminRecords(memberAdmins)
        }
      }

      setLoading(false)
    }

    loadData()
  }, [params.id, router])

  const handleChapterChange = async () => {
    if (!selectedChapter || selectedChapter === member.chapter_id) return

    setSaving(true)
    setError(null)
    setSuccess(null)

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

    const supabase = createClient()
    const { data: mcData } = await supabase
      .from('member_chapters')
      .select('chapter_id, is_primary, chapters(id, name, level)')
      .eq('member_id', params.id)

    setMemberChapters(mcData || [])
    setMember({ ...member, chapter_id: selectedChapter })
    setSuccess('Chapter updated')
    setSaving(false)
    setTimeout(() => setSuccess(null), 3000)
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
      setSuccess('Status updated')
      setTimeout(() => setSuccess(null), 3000)
    }
    setSaving(false)
  }

  const handleMakeAdmin = async () => {
    if (!selectedAdminChapter) {
      setError('Please select a chapter')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const selectedChapterData = chapters.find(c => c.id === selectedAdminChapter)
      const levelToRole = {
        national: 'national_admin',
        state: 'state_admin',
        county: 'county_admin',
        city: 'city_admin'
      }
      const role = levelToRole[selectedChapterData?.level] || 'state_admin'

      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: member.email,
          role: role,
          chapter_id: selectedAdminChapter,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to grant access')

      const supabase = createClient()
      const { data: memberAdmins } = await supabase
        .from('admin_users')
        .select('id, role, chapter_id, chapters(id, name, level)')
        .eq('user_id', member.user_id)
        .order('created_at', { ascending: false })

      setMemberAdminRecords(memberAdmins || [])
      setSelectedAdminChapter('')
      setSuccess('Admin access granted')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    }

    setSaving(false)
  }

  const handleRemoveAdmin = async (adminId) => {
    if (!adminId) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/admin/admins?id=${adminId}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove admin')

      const supabase = createClient()
      const { data: memberAdmins } = await supabase
        .from('admin_users')
        .select('id, role, chapter_id, chapters(id, name, level)')
        .eq('user_id', member.user_id)
        .order('created_at', { ascending: false })

      setMemberAdminRecords(memberAdmins || [])
      setSuccess('Admin access removed')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err.message)
    }

    setSaving(false)
  }

  const handleDeleteMember = async () => {
    if (!confirm('Are you sure you want to permanently delete this member? This cannot be undone.')) return

    setDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/members/${member.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete')
      router.push('/workspace/members')
    } catch (err) {
      setError(err.message)
      setDeleting(false)
    }
  }

  const canManageAdminRole = (targetRole) => {
    if (!currentUserRoles || currentUserRoles.length === 0) return false
    if (currentUserRoles.includes('super_admin')) return true
    if (['super_admin', 'national_admin'].includes(targetRole)) return false

    const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
    const targetIndex = roleHierarchy.indexOf(targetRole)

    for (const role of currentUserRoles) {
      if (role === 'national_admin') continue
      const roleIndex = roleHierarchy.indexOf(role)
      if (targetIndex >= roleIndex) return true
    }
    return false
  }

  const groupedChapters = chapters.reduce((acc, c) => {
    if (!acc[c.level]) acc[c.level] = []
    acc[c.level].push(c)
    return acc
  }, {})

  const inputClass = "w-full px-3 py-2 text-sm border border-stone-200 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-32 bg-gray-100 rounded" />
          <div className="h-32 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  if (error && !member) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 text-center">
        <p className="text-sm text-red-600 mb-3">{error}</p>
        <Link href="/workspace/members" className="text-sm text-labor-red hover:underline">Back to Members</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
        <Link href="/workspace/members" className="hover:text-gray-600">Members</Link>
        <span>/</span>
        <span className="text-gray-600">{member.first_name} {member.last_name}</span>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded mb-4 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-xs underline ml-2">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded mb-4 text-sm">
          {success}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-stone-200 rounded mb-4">
        <div className="px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-semibold text-gray-900">
                  {member.first_name} {member.last_name}
                </h1>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusBadgeColor[member.status]}`}>
                  {member.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{member.email}</p>
              {memberAdminRecords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {memberAdminRecords.map(record => (
                    <span key={record.id} className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${roleBadgeColor[record.role] || 'text-gray-700 bg-stone-50 border-stone-200'}`}>
                      {ROLE_LABELS[record.role] || 'Admin'}
                      {record.chapters && !['super_admin', 'national_admin'].includes(record.role) && (
                        <span className="ml-1 opacity-75">({record.chapters.name})</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Main content - 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact Information */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">Contact Information</h2>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <DetailRow label="Phone" value={member.phone || '-'} />
              <DetailRow label="Joined" value={new Date(member.joined_date).toLocaleDateString()} />
              <DetailRow label="Address" value={member.address_line1 || '-'} />
              <DetailRow label="Volunteer" value={member.wants_to_volunteer ? 'Yes' : 'No'} />
              <DetailRow label="City" value={member.city || '-'} />
              <DetailRow label="Mailing" value={member.mailing_list_opted_in ? 'Opted In' : 'Opted Out'} />
              <DetailRow label="State" value={member.state || '-'} />
              {member.bio && <DetailRow label="Bio" value={member.bio} />}
              <DetailRow label="ZIP" value={member.zip_code || '-'} />
              {member.volunteer_details && <DetailRow label="Vol. Details" value={member.volunteer_details} />}
            </div>
          </div>

          {/* Chapter Assignment */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">Chapter Assignment</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Primary Chapter</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <ChapterSelect
                      chapters={chapters}
                      value={selectedChapter}
                      onChange={(id) => setSelectedChapter(id)}
                    />
                  </div>
                  <button
                    onClick={handleChapterChange}
                    disabled={saving || selectedChapter === member.chapter_id}
                    className="px-3 py-2 text-sm font-medium text-white bg-labor-red rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    Update
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Changing the primary chapter updates all inherited memberships.
                </p>
              </div>

              {memberChapters.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">All Memberships</label>
                  <div className="flex flex-wrap gap-1.5">
                    {memberChapters
                      .sort((a, b) => {
                        const order = ['national', 'state', 'county', 'city']
                        return order.indexOf(a.chapters?.level) - order.indexOf(b.chapters?.level)
                      })
                      .map(mc => (
                        <span
                          key={mc.chapter_id}
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${levelBadgeColor[mc.chapters?.level] || 'text-gray-700 bg-stone-50 border-stone-200'}`}
                        >
                          {mc.chapters?.name}
                          {mc.is_primary && <span className="ml-1 opacity-60">(primary)</span>}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Admin Access */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">Admin Access</h2>
            </div>
            <div className="p-4 space-y-4">
              {/* Existing admin roles */}
              {memberAdminRecords.length > 0 && (
                <div className="space-y-2">
                  {memberAdminRecords.map(record => (
                    <div key={record.id} className="flex items-center justify-between p-3 border border-stone-200 rounded">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {ROLE_LABELS[record.role] || 'Admin'}
                        </div>
                        {record.chapters && (
                          <div className="text-xs text-gray-400">{record.chapters.name}</div>
                        )}
                      </div>
                      {canManageAdminRole(record.role) && (
                        <button
                          onClick={() => handleRemoveAdmin(record.id)}
                          disabled={saving}
                          className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Grant access form */}
              <div className={memberAdminRecords.length > 0 ? 'pt-2 border-t border-stone-200' : ''}>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  {memberAdminRecords.length > 0 ? 'Add Role' : 'Grant Admin Access'}
                </label>
                <div className="relative" ref={adminChapterDropdownRef}>
                  <input
                    type="text"
                    value={showAdminChapterDropdown ? adminChapterSearch : (chapters.find(c => c.id === selectedAdminChapter)?.name || '')}
                    onChange={(e) => {
                      setAdminChapterSearch(e.target.value)
                      if (!showAdminChapterDropdown) setShowAdminChapterDropdown(true)
                    }}
                    onFocus={() => {
                      setShowAdminChapterDropdown(true)
                      setAdminChapterSearch('')
                    }}
                    placeholder="Search chapters..."
                    className={inputClass}
                  />
                  {showAdminChapterDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded shadow-lg max-h-48 overflow-y-auto">
                      {['national', 'state', 'county', 'city'].map(level => {
                        const levelChapters = (groupedChapters[level] || []).filter(c =>
                          c.name.toLowerCase().includes(adminChapterSearch.toLowerCase())
                        )
                        if (levelChapters.length === 0) return null
                        return (
                          <div key={level}>
                            <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide bg-stone-50 border-b border-stone-100">
                              {level}
                            </div>
                            {levelChapters.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSelectedAdminChapter(c.id)
                                  setAdminChapterSearch('')
                                  setShowAdminChapterDropdown(false)
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-50 transition-colors"
                              >
                                {c.name}
                              </button>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                {selectedAdminChapter && (
                  <p className="text-xs text-gray-400 mt-1">
                    Will grant <span className="font-medium text-gray-600">
                      {chapters.find(c => c.id === selectedAdminChapter)?.level} admin
                    </span> access.
                  </p>
                )}
                <button
                  onClick={handleMakeAdmin}
                  disabled={saving || !selectedAdminChapter}
                  className="mt-2 px-3 py-1.5 text-sm font-medium text-white bg-labor-red rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Granting...' : 'Grant Access'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - 1/3 */}
        <div className="space-y-4">
          {/* Status */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">Status</h2>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-1.5">
                {['pending', 'active', 'lapsed', 'cancelled'].map(status => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={saving || member.status === status}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      member.status === status
                        ? 'bg-gray-900 text-white'
                        : 'bg-stone-50 text-gray-600 border border-stone-200 hover:bg-stone-100'
                    } disabled:opacity-50`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Info */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">Details</h2>
            </div>
            <div className="p-4 space-y-2.5">
              <SidebarRow label="Joined" value={new Date(member.joined_date).toLocaleDateString()} />
              <SidebarRow label="Status" value={member.status} />
              <SidebarRow label="Chapter" value={chapters.find(c => c.id === member.chapter_id)?.name || 'None'} />
              <SidebarRow label="Volunteer" value={member.wants_to_volunteer ? 'Yes' : 'No'} />
              <SidebarRow label="Mailing" value={member.mailing_list_opted_in ? 'Opted In' : 'Opted Out'} />
            </div>
          </div>

          {/* Danger Zone - Super Admin Only */}
          {currentUserRoles.includes('super_admin') && (
            <div className="bg-white border border-red-200 rounded">
              <div className="px-4 py-3 border-b border-red-200">
                <h2 className="text-sm font-semibold text-red-700">Danger Zone</h2>
              </div>
              <div className="p-4">
                <p className="text-xs text-gray-500 mb-3">
                  Permanently deletes this member, their chapter memberships, admin access, and auth account.
                </p>
                <button
                  onClick={handleDeleteMember}
                  disabled={deleting}
                  className="w-full px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 transition-colors"
                >
                  {deleting ? 'Deleting...' : 'Delete Member Permanently'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-baseline gap-2 py-1">
      <span className="text-xs text-gray-400 w-20 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  )
}

function SidebarRow({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-xs text-gray-700">{value}</span>
    </div>
  )
}
