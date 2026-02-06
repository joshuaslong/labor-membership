'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const ALL_ROLES = [
  { value: 'super_admin', label: 'Super Admin', group: 'admin' },
  { value: 'national_admin', label: 'National Admin', group: 'admin' },
  { value: 'state_admin', label: 'State Admin', group: 'admin' },
  { value: 'county_admin', label: 'County Admin', group: 'admin' },
  { value: 'city_admin', label: 'City Admin', group: 'admin' },
  { value: 'membership_coordinator', label: 'Membership Coordinator', group: 'team' },
  { value: 'event_coordinator', label: 'Event Coordinator', group: 'team' },
  { value: 'communications_lead', label: 'Communications Lead', group: 'team' },
  { value: 'content_creator', label: 'Content Creator', group: 'team' },
  { value: 'volunteer_manager', label: 'Volunteer Manager', group: 'team' },
  { value: 'data_manager', label: 'Data Manager', group: 'team' },
]

const roleBadgeColor = {
  super_admin: 'text-purple-700 bg-purple-50 border-purple-200',
  national_admin: 'text-red-700 bg-red-50 border-red-200',
  state_admin: 'text-blue-700 bg-blue-50 border-blue-200',
  county_admin: 'text-green-700 bg-green-50 border-green-200',
  city_admin: 'text-amber-700 bg-amber-50 border-amber-200',
  membership_coordinator: 'text-teal-700 bg-teal-50 border-teal-200',
  event_coordinator: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  communications_lead: 'text-pink-700 bg-pink-50 border-pink-200',
  content_creator: 'text-violet-700 bg-violet-50 border-violet-200',
  volunteer_manager: 'text-orange-700 bg-orange-50 border-orange-200',
  data_manager: 'text-cyan-700 bg-cyan-50 border-cyan-200',
}

export default function TeamMemberDetailPage() {
  const router = useRouter()
  const params = useParams()
  const [member, setMember] = useState(null)
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({ roles: [], chapter_id: '', active: true })

  useEffect(() => {
    loadMember()
    loadChapters()
  }, [params.id])

  const loadMember = async () => {
    try {
      const res = await fetch(`/api/admin/team-members/${params.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setMember(data.teamMember)
      setEditData({
        roles: data.teamMember.roles || [],
        chapter_id: data.teamMember.chapter_id || '',
        active: data.teamMember.active,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadChapters = async () => {
    const res = await fetch('/api/chapters')
    const data = await res.json()
    setChapters(data.chapters || [])
  }

  const toggleRole = (role) => {
    setEditData(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role],
    }))
  }

  const handleSave = async () => {
    if (editData.roles.length === 0) {
      setError('At least one role is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/admin/team-members/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')

      setMember(data.teamMember)
      setEditing(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    if (!confirm('Are you sure you want to deactivate this team member? They will lose access to the workspace.')) return

    try {
      const res = await fetch(`/api/admin/team-members/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to deactivate')

      setMember(data.teamMember)
      setEditData(prev => ({ ...prev, active: false }))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleReactivate = async () => {
    try {
      const res = await fetch(`/api/admin/team-members/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: true }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to reactivate')

      setMember(data.teamMember)
      setEditData(prev => ({ ...prev, active: true }))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to permanently remove this team member? This cannot be undone.')) return

    try {
      const res = await fetch(`/api/admin/team-members/${params.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }

      router.push('/workspace/admin/team')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-32" />
          <div className="h-32 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <p className="text-sm text-gray-500">Team member not found.</p>
        <Link href="/workspace/admin/team" className="text-sm text-labor-red hover:underline mt-2 inline-block">
          Back to team
        </Link>
      </div>
    )
  }

  const memberName = member.member
    ? `${member.member.first_name} ${member.member.last_name}`
    : 'Unknown User'

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
        <Link href="/workspace/admin/team" className="hover:text-gray-600">Team</Link>
        <span>/</span>
        <span className="text-gray-600">{memberName}</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-xs">Dismiss</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{memberName}</h1>
          <p className="text-sm text-gray-500">{member.member?.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
              member.active ? 'text-green-700 bg-green-50 border-green-200' : 'text-gray-700 bg-stone-50 border-stone-200'
            }`}>
              {member.active ? 'Active' : 'Inactive'}
            </span>
            {member.chapter && (
              <span className="text-xs text-gray-400">{member.chapter.name}</span>
            )}
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50 transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {/* View Mode */}
      {!editing && (
        <>
          {/* Current Roles */}
          <div className="bg-white border border-stone-200 rounded mb-6">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">Roles</h2>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {member.roles?.map(role => {
                  const roleInfo = ALL_ROLES.find(r => r.value === role)
                  return (
                    <span
                      key={role}
                      className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-medium border ${roleBadgeColor[role] || 'text-gray-700 bg-stone-50 border-stone-200'}`}
                    >
                      {roleInfo?.label || role}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="bg-white border border-stone-200 rounded mb-6">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">Details</h2>
            </div>
            <div className="p-4 space-y-3">
              <DetailRow label="Chapter" value={member.chapter?.name || 'None (national scope)'} />
              <DetailRow label="Member Since" value={new Date(member.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} />
              {member.member?.id && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">Member Profile</span>
                  <Link href={`/workspace/members/${member.member.id}`} className="text-sm text-labor-red hover:underline">
                    View Profile
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">Actions</h2>
            </div>
            <div className="p-4 space-y-3">
              {member.active ? (
                <button
                  onClick={handleDeactivate}
                  className="w-full px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors"
                >
                  Deactivate Team Member
                </button>
              ) : (
                <button
                  onClick={handleReactivate}
                  className="w-full px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition-colors"
                >
                  Reactivate Team Member
                </button>
              )}
              <button
                onClick={handleDelete}
                className="w-full px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
              >
                Remove Permanently
              </button>
            </div>
          </div>
        </>
      )}

      {/* Edit Mode */}
      {editing && (
        <>
          {/* Chapter */}
          <div className="bg-white border border-stone-200 rounded mb-6">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">Chapter</h2>
            </div>
            <div className="p-4">
              <select
                value={editData.chapter_id}
                onChange={(e) => setEditData(prev => ({ ...prev, chapter_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
              >
                <option value="">No chapter (national scope)</option>
                {chapters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Roles */}
          <div className="bg-white border border-stone-200 rounded mb-6">
            <div className="px-4 py-3 border-b border-stone-200">
              <h2 className="text-sm font-semibold text-gray-900">Roles</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Admin Roles</h3>
                <div className="space-y-1">
                  {ALL_ROLES.filter(r => r.group === 'admin').map(role => (
                    <label
                      key={role.value}
                      className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                        editData.roles.includes(role.value) ? 'bg-gray-50 border border-stone-200' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={editData.roles.includes(role.value)}
                        onChange={() => toggleRole(role.value)}
                        className="rounded border-gray-300 text-labor-red focus:ring-labor-red"
                      />
                      <span className="text-sm text-gray-900">{role.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Team Roles</h3>
                <div className="space-y-1">
                  {ALL_ROLES.filter(r => r.group === 'team').map(role => (
                    <label
                      key={role.value}
                      className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                        editData.roles.includes(role.value) ? 'bg-gray-50 border border-stone-200' : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={editData.roles.includes(role.value)}
                        onChange={() => toggleRole(role.value)}
                        className="rounded border-gray-300 text-labor-red focus:ring-labor-red"
                      />
                      <span className="text-sm text-gray-900">{role.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Save/Cancel */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-labor-red rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => {
                setEditing(false)
                setEditData({
                  roles: member.roles || [],
                  chapter_id: member.chapter_id || '',
                  active: member.active,
                })
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-900">{value}</span>
    </div>
  )
}
