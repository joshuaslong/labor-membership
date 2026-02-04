'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ChapterSelect from '@/components/ChapterSelect'

export default function AdminGroupsPage() {
  const [adminInfo, setAdminInfo] = useState(null)
  const [chapters, setChapters] = useState([])
  const [selectedChapterId, setSelectedChapterId] = useState('')
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '' })

  // Member management state
  const [managingGroup, setManagingGroup] = useState(null)
  const [groupMembers, setGroupMembers] = useState([])
  const [chapterMembers, setChapterMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [memberSearch, setMemberSearch] = useState('')

  // Load admin info and chapters
  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data: adminRecords } = await supabase
        .from('admin_users')
        .select('id, role, chapter_id, chapters(id, name)')
        .eq('user_id', user.id)

      if (!adminRecords || adminRecords.length === 0) {
        setLoading(false)
        return
      }

      const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
      const admin = adminRecords.reduce((highest, current) => {
        const currentIndex = roleHierarchy.indexOf(current.role)
        const highestIndex = roleHierarchy.indexOf(highest.role)
        return currentIndex < highestIndex ? current : highest
      }, adminRecords[0])

      setAdminInfo(admin)

      // Load accessible chapters
      if (['super_admin', 'national_admin'].includes(admin.role)) {
        const { data: allChapters } = await supabase
          .from('chapters')
          .select('id, name, level')
          .order('name')
        setChapters(allChapters || [])
      } else if (admin.chapter_id) {
        const { data: descendants } = await supabase
          .rpc('get_chapter_descendants', { chapter_uuid: admin.chapter_id })
        const chapterIds = [admin.chapter_id, ...(descendants?.map(d => d.id) || [])]
        const { data: accessibleChapters } = await supabase
          .from('chapters')
          .select('id, name, level')
          .in('id', chapterIds)
          .order('name')
        setChapters(accessibleChapters || [])
      }

      // Auto-select chapter if admin only has one
      if (admin.chapter_id && !['super_admin', 'national_admin'].includes(admin.role)) {
        setSelectedChapterId(admin.chapter_id)
      }

      setLoading(false)
    }

    loadData()
  }, [])

  // Fetch groups when chapter changes
  useEffect(() => {
    if (!selectedChapterId) {
      setGroups([])
      return
    }
    fetchGroups()
  }, [selectedChapterId])

  const fetchGroups = async () => {
    setGroupsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/groups?chapterId=${selectedChapterId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setGroups(data.groups || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setGroupsLoading(false)
    }
  }

  // Form handlers
  const resetForm = () => {
    setFormData({ name: '', description: '' })
    setEditingGroup(null)
    setShowForm(false)
  }

  const handleEdit = (group) => {
    setFormData({ name: group.name, description: group.description || '' })
    setEditingGroup(group)
    setShowForm(true)
    setManagingGroup(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const url = editingGroup
        ? `/api/admin/groups/${editingGroup.id}`
        : '/api/admin/groups'

      const res = await fetch(url, {
        method: editingGroup ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          chapterId: selectedChapterId,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      resetForm()
      fetchGroups()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (group) => {
    if (!confirm(`Delete group "${group.name}"? All member assignments will be removed.`)) return

    try {
      const res = await fetch(`/api/admin/groups/${group.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (managingGroup?.id === group.id) setManagingGroup(null)
      fetchGroups()
    } catch (err) {
      alert(`Failed to delete: ${err.message}`)
    }
  }

  // Member management handlers
  const openMemberManagement = async (group) => {
    setManagingGroup(group)
    setShowForm(false)
    setMembersLoading(true)
    setSelectedMemberIds([])
    setMemberSearch('')

    try {
      // Fetch group members and chapter members in parallel
      const [groupRes, chapterRes] = await Promise.all([
        fetch(`/api/admin/groups/${group.id}/members`),
        fetch(`/api/members?chapter_id=${group.chapter_id}&status=active&limit=500`),
      ])

      const groupData = await groupRes.json()
      const chapterData = await chapterRes.json()

      if (!groupRes.ok) throw new Error(groupData.error)
      if (!chapterRes.ok) throw new Error(chapterData.error)

      setGroupMembers(groupData.members || [])
      setChapterMembers(chapterData.members || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setMembersLoading(false)
    }
  }

  const handleAddMembers = async () => {
    if (selectedMemberIds.length === 0) return

    try {
      const res = await fetch(`/api/admin/groups/${managingGroup.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds: selectedMemberIds }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setSelectedMemberIds([])
      // Refresh both lists
      openMemberManagement(managingGroup)
      fetchGroups()
    } catch (err) {
      alert(`Failed to add members: ${err.message}`)
    }
  }

  const handleRemoveMember = async (memberId) => {
    try {
      const res = await fetch(`/api/admin/groups/${managingGroup.id}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds: [memberId] }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      openMemberManagement(managingGroup)
      fetchGroups()
    } catch (err) {
      alert(`Failed to remove member: ${err.message}`)
    }
  }

  const toggleMemberSelection = (memberId) => {
    setSelectedMemberIds(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    )
  }

  // Filter chapter members to exclude those already in the group
  const groupMemberIds = new Set(groupMembers.map(m => m.id))
  const availableMembers = chapterMembers.filter(m => !groupMemberIds.has(m.id))
  const filteredAvailable = memberSearch
    ? availableMembers.filter(m =>
        `${m.first_name} ${m.last_name} ${m.email}`
          .toLowerCase()
          .includes(memberSearch.toLowerCase())
      )
    : availableMembers

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  if (!adminInfo) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center text-gray-500">You do not have admin access.</div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/admin" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block">
        &larr; Back to Admin Dashboard
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl text-gray-900">Chapter Groups</h1>
          <p className="text-gray-600 mt-1">Create groups within chapters for targeted communications</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Chapter Selector */}
      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Chapter
        </label>
        <div className="max-w-md">
          <ChapterSelect
            chapters={chapters}
            value={selectedChapterId}
            onChange={(id) => {
              setSelectedChapterId(id)
              setManagingGroup(null)
              resetForm()
            }}
          />
        </div>
      </div>

      {selectedChapterId && (
        <>
          {/* Create / Edit Form */}
          {!showForm && !managingGroup && (
            <div className="mb-6">
              <button onClick={() => setShowForm(true)} className="btn-primary">
                New Group
              </button>
            </div>
          )}

          {showForm && (
            <div className="card mb-6">
              <h2 className="text-xl font-semibold mb-6">
                {editingGroup ? 'Edit Group' : 'New Group'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className="input-field"
                    placeholder="e.g., Volunteers, Phone Bank Team"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="input-field"
                    placeholder="What is this group for?"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? 'Saving...' : (editingGroup ? 'Update Group' : 'Create Group')}
                  </button>
                  <button type="button" onClick={resetForm} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Member Management Panel */}
          {managingGroup && (
            <div className="card mb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold">{managingGroup.name}</h2>
                  {managingGroup.description && (
                    <p className="text-sm text-gray-500 mt-1">{managingGroup.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setManagingGroup(null)}
                  className="btn-secondary text-sm"
                >
                  Close
                </button>
              </div>

              {membersLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-labor-red mx-auto"></div>
                  <p className="mt-3 text-gray-500 text-sm">Loading members...</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Current Members */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Current Members ({groupMembers.length})
                    </h3>
                    {groupMembers.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4">No members in this group yet.</p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {groupMembers.map(member => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {member.first_name} {member.last_name}
                              </div>
                              <div className="text-xs text-gray-500 truncate">{member.email}</div>
                            </div>
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-xs text-red-600 hover:text-red-800 font-medium ml-2 flex-shrink-0"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Members */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Add Members ({availableMembers.length} available)
                    </h3>
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search members..."
                      className="input-field mb-3 text-sm"
                    />
                    {filteredAvailable.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4">
                        {availableMembers.length === 0 ? 'All chapter members are in this group.' : 'No members match your search.'}
                      </p>
                    ) : (
                      <>
                        <div className="space-y-1 max-h-64 overflow-y-auto mb-3">
                          {filteredAvailable.map(member => (
                            <label
                              key={member.id}
                              className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedMemberIds.includes(member.id)}
                                onChange={() => toggleMemberSelection(member.id)}
                                className="rounded border-gray-300 text-labor-red focus:ring-labor-red"
                              />
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">
                                  {member.first_name} {member.last_name}
                                </div>
                                <div className="text-xs text-gray-500 truncate">{member.email}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                        {selectedMemberIds.length > 0 && (
                          <button
                            onClick={handleAddMembers}
                            className="btn-primary text-sm w-full"
                          >
                            Add {selectedMemberIds.length} Member{selectedMemberIds.length !== 1 ? 's' : ''}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Groups List */}
          {groupsLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red mx-auto"></div>
              <p className="mt-4 text-gray-500">Loading groups...</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-12 card">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No groups yet</h3>
              <p className="text-gray-500 text-sm">Create your first group for this chapter.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map(group => (
                <div
                  key={group.id}
                  className={`card flex items-center justify-between ${
                    managingGroup?.id === group.id ? 'ring-2 ring-labor-red' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{group.name}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {group.description && (
                      <p className="text-sm text-gray-500 line-clamp-1">{group.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => openMemberManagement(group)}
                      className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded font-medium"
                    >
                      Members
                    </button>
                    <button
                      onClick={() => handleEdit(group)}
                      className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 hover:bg-blue-100 rounded font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(group)}
                      className="px-3 py-1.5 text-sm bg-red-50 text-red-700 hover:bg-red-100 rounded font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
