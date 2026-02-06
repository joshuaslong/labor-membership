'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const ADMIN_ROLES = [
  { value: 'super_admin', label: 'Super Admin', desc: 'Full access to everything' },
  { value: 'national_admin', label: 'National Admin', desc: 'Full access to all member data' },
  { value: 'state_admin', label: 'State Admin', desc: 'Manages state and sub-chapters' },
  { value: 'county_admin', label: 'County Admin', desc: 'Manages county and city chapters' },
  { value: 'city_admin', label: 'City Admin', desc: 'Manages city chapter only' },
]

const TEAM_ROLES = [
  { value: 'membership_coordinator', label: 'Membership Coordinator', desc: 'Member management' },
  { value: 'event_coordinator', label: 'Event Coordinator', desc: 'Event management' },
  { value: 'communications_lead', label: 'Communications Lead', desc: 'Email and comms' },
  { value: 'content_creator', label: 'Content Creator', desc: 'Resources and media' },
  { value: 'volunteer_manager', label: 'Volunteer Manager', desc: 'Task management' },
  { value: 'data_manager', label: 'Data Manager', desc: 'Data and analytics' },
]

export default function AddTeamMemberPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [chapters, setChapters] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)

  const [formData, setFormData] = useState({
    user_id: '',
    member_name: '',
    chapter_id: '',
    roles: [],
  })

  useEffect(() => {
    loadChapters()
  }, [])

  const loadChapters = async () => {
    const res = await fetch('/api/chapters')
    const data = await res.json()
    setChapters(data.chapters || [])
  }

  const searchMembers = async (query) => {
    setSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    const supabase = createClient()
    const term = `%${query}%`
    const { data } = await supabase
      .from('members')
      .select('id, user_id, first_name, last_name, email')
      .or(`first_name.ilike.${term},last_name.ilike.${term},email.ilike.${term}`)
      .not('user_id', 'is', null)
      .limit(10)

    setSearchResults(data || [])
    setSearching(false)
  }

  const selectMember = (member) => {
    setFormData(prev => ({
      ...prev,
      user_id: member.user_id,
      member_name: `${member.first_name} ${member.last_name} (${member.email})`,
    }))
    setSearchResults([])
    setSearchQuery('')
  }

  const toggleRole = (role) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.user_id) {
      setError('Please select a member')
      return
    }
    if (formData.roles.length === 0) {
      setError('Please select at least one role')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/team-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: formData.user_id,
          chapter_id: formData.chapter_id || null,
          roles: formData.roles,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add team member')

      router.push('/workspace/admin/team')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full px-3 py-2 text-sm border border-stone-200 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
  const labelClass = "block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1"

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Add Team Member</h1>
        <Link href="/workspace/admin/team" className="text-sm text-gray-500 hover:text-gray-700">
          Back to team
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Member Selection */}
        <div className="bg-white border border-stone-200 rounded">
          <div className="px-4 py-3 border-b border-stone-200">
            <h2 className="text-sm font-semibold text-gray-900">Select Member</h2>
          </div>
          <div className="p-4">
            {formData.user_id ? (
              <div className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded px-3 py-2">
                <span className="text-sm text-gray-900">{formData.member_name}</span>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, user_id: '', member_name: '' }))}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <label className={labelClass}>Search by name or email</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => searchMembers(e.target.value)}
                  className={inputClass}
                  placeholder="Start typing a name or email..."
                />
                {searching && (
                  <div className="absolute right-3 top-8 text-xs text-gray-400">Searching...</div>
                )}
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-stone-200 rounded shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectMember(m)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors border-b border-stone-100 last:border-0"
                      >
                        <div className="text-sm text-gray-900">{m.first_name} {m.last_name}</div>
                        <div className="text-xs text-gray-500">{m.email}</div>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">Member must already have an account.</p>
              </div>
            )}
          </div>
        </div>

        {/* Chapter Assignment */}
        <div className="bg-white border border-stone-200 rounded">
          <div className="px-4 py-3 border-b border-stone-200">
            <h2 className="text-sm font-semibold text-gray-900">Chapter</h2>
          </div>
          <div className="p-4">
            <label className={labelClass}>Chapter Assignment</label>
            <select
              value={formData.chapter_id}
              onChange={(e) => setFormData(prev => ({ ...prev, chapter_id: e.target.value }))}
              className={inputClass}
            >
              <option value="">No chapter (national scope)</option>
              {chapters.map(c => (
                <option key={c.id} value={c.id}>
                  {c.level === 'national' ? c.name : `${'  '.repeat(['state', 'county', 'city'].indexOf(c.level) + 1)}${c.name}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Roles */}
        <div className="bg-white border border-stone-200 rounded">
          <div className="px-4 py-3 border-b border-stone-200">
            <h2 className="text-sm font-semibold text-gray-900">Roles</h2>
            <p className="text-xs text-gray-400 mt-0.5">Select one or more roles for this team member</p>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Admin Roles</h3>
              <div className="space-y-1">
                {ADMIN_ROLES.map(role => (
                  <label
                    key={role.value}
                    className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                      formData.roles.includes(role.value) ? 'bg-gray-50 border border-stone-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.roles.includes(role.value)}
                      onChange={() => toggleRole(role.value)}
                      className="rounded border-gray-300 text-labor-red focus:ring-labor-red"
                    />
                    <div>
                      <div className="text-sm text-gray-900">{role.label}</div>
                      <div className="text-xs text-gray-400">{role.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Team Roles</h3>
              <div className="space-y-1">
                {TEAM_ROLES.map(role => (
                  <label
                    key={role.value}
                    className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer transition-colors ${
                      formData.roles.includes(role.value) ? 'bg-gray-50 border border-stone-200' : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={formData.roles.includes(role.value)}
                      onChange={() => toggleRole(role.value)}
                      className="rounded border-gray-300 text-labor-red focus:ring-labor-red"
                    />
                    <div>
                      <div className="text-sm text-gray-900">{role.label}</div>
                      <div className="text-xs text-gray-400">{role.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-labor-red rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Adding...' : 'Add Team Member'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/workspace/admin/team')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
