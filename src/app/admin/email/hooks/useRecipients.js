import { useState, useCallback } from 'react'

/**
 * Hook for managing recipient selection logic
 */
export function useRecipients() {
  const [recipientType, setRecipientType] = useState('my_chapter')
  const [selectedChapterId, setSelectedChapterId] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [groupChapterId, setGroupChapterId] = useState('')
  const [groups, setGroups] = useState([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchGroups = useCallback(async (chapterId) => {
    setGroupsLoading(true)
    setError(null) // Clear previous errors
    try {
      const res = await fetch(`/api/admin/groups?chapterId=${chapterId}`)
      const data = await res.json()
      if (res.ok) {
        setGroups(data.groups || [])
      } else {
        setGroups([])
        setError(`Failed to load groups: ${data.error || 'Unknown error'}`)
      }
    } catch (err) {
      setGroups([])
      setError('Network error while loading groups. Please try again.')
      console.error('Error fetching groups:', err)
    } finally {
      setGroupsLoading(false)
    }
  }, [])

  const handleGroupChapterChange = useCallback((chapterId) => {
    setGroupChapterId(chapterId)
    setSelectedGroupId('')
    if (chapterId) {
      fetchGroups(chapterId)
    } else {
      setGroups([])
    }
  }, [fetchGroups])

  // Validation helper
  const isValid = useCallback(() => {
    if (recipientType === 'chapter' && !selectedChapterId) return false
    if (recipientType === 'group' && !selectedGroupId) return false
    return true
  }, [recipientType, selectedChapterId, selectedGroupId])

  return {
    recipientType,
    setRecipientType,
    selectedChapterId,
    setSelectedChapterId,
    selectedGroupId,
    setSelectedGroupId,
    groupChapterId,
    groups,
    groupsLoading,
    handleGroupChapterChange,
    isValid,
    error,
    setError
  }
}
