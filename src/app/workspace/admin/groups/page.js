'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ChapterSelect from '@/components/ChapterSelect'

export default function WorkspaceGroupsPage() {
  const searchParams = useSearchParams()
  const preselectedChapter = searchParams.get('chapter')

  const [chapters, setChapters] = useState([])
  const [selectedChapterId, setSelectedChapterId] = useState(preselectedChapter || '')
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

  // Load chapters based on admin role
  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: teamMember } = await supabase
        .from('team_members')
        .select('id, roles, chapter_id, is_media_team')
        .eq('user_id', user.id)
        .eq('active', true)
        .single()

      if (!teamMember || !teamMember.roles?.length) {
        setLoading(false)
        return
      }

      const roleHierarchy = ['super_admin', 'national_admin', 'state_admin', 'county_admin', 'city_admin']
      const highestRole = roleHierarchy.find(r => teamMember.roles.includes(r)) || teamMember.roles[0]
      const admin = { id: teamMember.id, role: highestRole, chapter_id: teamMember.chapter_id }

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

      // Auto-select chapter if admin only has one and no preselected
      if (!preselectedChapter && admin.chapter_id && !['super_admin', 'national_admin'].includes(admin.role)) {
        setSelectedChapterId(admin.chapter_id)
      }

      setLoading(false)
    }

    loadData()
  }, [preselectedChapter])

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

  // Member management
  const openMemberManagement = async (group) => {
    setManagingGroup(group)
    setShowForm(false)
    setMembersLoading(true)
    setSelectedMemberIds([])
    setMemberSearch('')

    try {
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

  // Filter available members
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-labor-red mx-auto"></div>
        <p className="mt-3 text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Chapter Groups</h1>
          <p className="text-xs text-gray-500 mt-0.5">Create groups within chapters for targeted communications</p>
        </div>
        {selectedChapterId && !showForm && !managingGroup && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-labor-red hover:bg-red-700 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Group
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
          {error}
        </div>
      )}

      {/* Chapter Selector */}
      <div className="mb-5">
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Select Chapter
        </label>
        <div className="max-w-sm">
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
          {showForm && (
            <div className="bg-white border border-stone-200 rounded mb-5">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900">
                  {editingGroup ? 'Edit Group' : 'New Group'}
                </h2>
              </div>
              <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
                    placeholder="e.g., Volunteers, Phone Bank Team"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-stone-200 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
                    placeholder="What is this group for?"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-labor-red rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : (editingGroup ? 'Update Group' : 'Create Group')}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Member Management Panel */}
          {managingGroup && (
            <div className="bg-white border border-stone-200 rounded mb-5">
              <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{managingGroup.name}</h2>
                  {managingGroup.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{managingGroup.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setManagingGroup(null)}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-stone-200 rounded hover:bg-stone-50 transition-colors"
                >
                  Close
                </button>
              </div>

              {membersLoading ? (
                <div className="py-8 text-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-labor-red mx-auto"></div>
                  <p className="mt-2 text-xs text-gray-500">Loading members...</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-200">
                  {/* Current Members */}
                  <div className="p-4">
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                      Current Members ({groupMembers.length})
                    </h3>
                    {groupMembers.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4">No members in this group yet.</p>
                    ) : (
                      <div className="space-y-1 max-h-80 overflow-y-auto">
                        {groupMembers.map(member => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between px-3 py-2 bg-stone-50 rounded"
                          >
                            <div className="min-w-0">
                              <div className="text-sm text-gray-900 truncate">
                                {member.first_name} {member.last_name}
                              </div>
                              <div className="text-xs text-gray-500 truncate">{member.email}</div>
                            </div>
                            <button
                              onClick={() => handleRemoveMember(member.id)}
                              className="text-xs text-red-600 hover:text-red-800 font-medium ml-2 shrink-0"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Members */}
                  <div className="p-4">
                    <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                      Add Members ({availableMembers.length} available)
                    </h3>
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search members..."
                      className="w-full px-3 py-2 text-sm border border-stone-200 rounded bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red mb-3"
                    />
                    {filteredAvailable.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4">
                        {availableMembers.length === 0 ? 'All chapter members are in this group.' : 'No members match your search.'}
                      </p>
                    ) : (
                      <>
                        <div className="space-y-0.5 max-h-64 overflow-y-auto mb-3">
                          {filteredAvailable.map(member => (
                            <label
                              key={member.id}
                              className="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedMemberIds.includes(member.id)}
                                onChange={() => toggleMemberSelection(member.id)}
                                className="rounded border-gray-300 text-labor-red focus:ring-labor-red"
                              />
                              <div className="min-w-0">
                                <div className="text-sm text-gray-900 truncate">
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
                            className="w-full px-4 py-2 text-sm font-medium text-white bg-labor-red rounded hover:bg-red-700 transition-colors"
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
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-labor-red mx-auto"></div>
              <p className="mt-3 text-sm text-gray-500">Loading groups...</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded p-12 text-center">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              <p className="text-sm text-gray-500 mb-1">No groups yet</p>
              <p className="text-xs text-gray-400">Create your first group for this chapter.</p>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded divide-y divide-stone-100">
              {groups.map(group => (
                <div
                  key={group.id}
                  className={`flex items-center gap-3 px-4 py-3 ${
                    managingGroup?.id === group.id ? 'bg-red-50/30' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 truncate">{group.name}</span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {group.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{group.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openMemberManagement(group)}
                      className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-stone-50 border border-stone-200 rounded hover:bg-stone-100 transition-colors"
                    >
                      Members
                    </button>
                    <button
                      onClick={() => handleEdit(group)}
                      className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(group)}
                      className="px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors"
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
