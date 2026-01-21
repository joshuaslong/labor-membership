'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  national_admin: 'National Admin',
  state_admin: 'State Admin',
  county_admin: 'County Admin',
  city_admin: 'City Admin',
}

const ROLE_COLORS = {
  super_admin: 'bg-purple-100 text-purple-800',
  national_admin: 'bg-red-100 text-red-800',
  state_admin: 'bg-blue-100 text-blue-800',
  county_admin: 'bg-green-100 text-green-800',
  city_admin: 'bg-yellow-100 text-yellow-800',
}

export default function ManageAdminsPage() {
  const [admins, setAdmins] = useState([])
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({ email: '', role: 'national_admin', chapter_id: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchAdmins()
    fetchChapters()
  }, [])

  const fetchAdmins = async () => {
    try {
      const res = await fetch('/api/admin/admins')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAdmins(data.admins || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchChapters = async () => {
    try {
      const res = await fetch('/api/chapters')
      const data = await res.json()
      setChapters(data.chapters || [])
    } catch (err) {
      console.error('Error fetching chapters:', err)
    }
  }

  const handleAddAdmin = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setShowAddForm(false)
      setFormData({ email: '', role: 'national_admin', chapter_id: '' })
      fetchAdmins()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveAdmin = async (adminId, adminName) => {
    if (!confirm(`Are you sure you want to remove ${adminName} as an admin?`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/admins?id=${adminId}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      fetchAdmins()
    } catch (err) {
      setError(err.message)
    }
  }

  // Filter chapters based on selected role
  const getChaptersForRole = (role) => {
    if (role === 'national_admin') {
      return chapters.filter(c => c.level === 'national')
    }
    const levelMap = {
      state_admin: 'state',
      county_admin: 'county',
      city_admin: 'city',
    }
    const level = levelMap[role]
    return chapters.filter(c => c.level === level)
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <p className="text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link href="/admin" className="text-red-700 hover:underline mb-4 inline-block">
        &larr; Back to Admin
      </Link>

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl text-gray-900">Manage Administrators</h1>
          <p className="text-gray-600 mt-1">Add or remove admin access for members.</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary"
        >
          {showAddForm ? 'Cancel' : 'Add Admin'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {showAddForm && (
        <div className="card mb-8">
          <h2 className="text-xl mb-4">Add New Admin</h2>
          <form onSubmit={handleAddAdmin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Member Email *
              </label>
              <input
                type="email"
                required
                className="input-field"
                placeholder="member@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                The member must already have an account.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role *
              </label>
              <select
                required
                className="input-field"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value, chapter_id: '' })}
              >
                <option value="national_admin">National Admin</option>
                <option value="state_admin">State Admin</option>
                <option value="county_admin">County Admin</option>
                <option value="city_admin">City Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chapter *
              </label>
              <select
                required
                className="input-field"
                value={formData.chapter_id}
                onChange={(e) => setFormData({ ...formData, chapter_id: e.target.value })}
              >
                <option value="">Select a chapter...</option>
                {getChaptersForRole(formData.role).map(chapter => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full"
              >
                {submitting ? 'Adding...' : 'Add Admin'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        <h2 className="text-xl mb-4">Current Administrators</h2>

        {admins.length === 0 ? (
          <p className="text-gray-500">No administrators found.</p>
        ) : (
          <div className="space-y-4">
            {admins.map(admin => (
              <div
                key={admin.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      {admin.first_name} {admin.last_name}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${ROLE_COLORS[admin.role]}`}>
                      {ROLE_LABELS[admin.role]}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {admin.email}
                  </div>
                  {admin.chapters && (
                    <div className="text-sm text-gray-500">
                      {admin.chapters.name}
                    </div>
                  )}
                </div>

                {admin.can_manage && !['super_admin', 'national_admin'].includes(admin.role) && (
                  <button
                    onClick={() => handleRemoveAdmin(admin.id, `${admin.first_name} ${admin.last_name}`)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Admin Hierarchy</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><strong>Super Admin:</strong> Full access to all chapters, can manage admins and create chapters</li>
          <li><strong>National Admin:</strong> Full access to all member data, but cannot manage admins or chapters</li>
          <li><strong>State Admin:</strong> Manages their state chapter and all county/city chapters within</li>
          <li><strong>County Admin:</strong> Manages their county chapter and all city chapters within</li>
          <li><strong>City Admin:</strong> Manages their city chapter only</li>
        </ul>
      </div>
    </div>
  )
}
