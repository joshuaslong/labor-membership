'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

function FolderIcon() {
  return (
    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function ChevronIcon({ expanded }) {
  return (
    <svg
      className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function FolderNode({ folder, depth, selectedFolderId, onFolderSelect, chapterId, onFolderCreated }) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState(null)
  const [loadingChildren, setLoadingChildren] = useState(false)
  const [showNewInput, setShowNewInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const hasSubfolders = folder.subfolder_count > 0
  const isSelected = selectedFolderId === folder.id

  const fetchChildren = useCallback(async () => {
    if (children !== null) return
    setLoadingChildren(true)
    try {
      const params = new URLSearchParams({ chapter_id: chapterId, parent_id: folder.id })
      const res = await fetch(`/api/folders?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setChildren(data.folders)
    } catch (err) {
      console.error('Failed to load subfolders:', err)
      setChildren([])
    } finally {
      setLoadingChildren(false)
    }
  }, [chapterId, folder.id, children])

  const handleToggle = async (e) => {
    e.stopPropagation()
    if (!expanded && hasSubfolders) {
      await fetchChildren()
    }
    setExpanded(!expanded)
  }

  const handleSelect = () => {
    onFolderSelect(folder.id)
  }

  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim()
    if (!trimmed) return

    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, chapter_id: chapterId, parent_id: folder.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Refresh children
      setChildren(null)
      setExpanded(true)
      await fetchChildren()
      setNewFolderName('')
      setShowNewInput(false)
      if (onFolderCreated) onFolderCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCreateFolder()
    } else if (e.key === 'Escape') {
      setShowNewInput(false)
      setNewFolderName('')
      setError(null)
    }
  }

  useEffect(() => {
    if (showNewInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showNewInput])

  // Refresh children when they become stale after creation
  useEffect(() => {
    if (expanded && children === null && hasSubfolders) {
      fetchChildren()
    }
  }, [expanded, children, hasSubfolders, fetchChildren])

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer group text-sm ${
          isSelected
            ? 'bg-stone-100 text-gray-900 font-medium'
            : 'text-gray-700 hover:bg-stone-50'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleSelect}
      >
        {/* Chevron */}
        <button
          onClick={handleToggle}
          className="p-0.5 -ml-1 hover:bg-stone-200 rounded transition-colors flex-shrink-0"
          disabled={!hasSubfolders}
        >
          {hasSubfolders ? (
            <ChevronIcon expanded={expanded} />
          ) : (
            <span className="w-3.5 h-3.5 block" />
          )}
        </button>

        <FolderIcon />

        <span className="truncate flex-1">{folder.name}</span>

        {/* File count badge */}
        {folder.file_count > 0 && (
          <span className="text-xs text-gray-400 flex-shrink-0">{folder.file_count}</span>
        )}

        {/* New subfolder button - only show at depth < 2 */}
        {depth < 2 && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowNewInput(true)
              if (!expanded) {
                setExpanded(true)
                if (hasSubfolders) fetchChildren()
              }
            }}
            className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-stone-200 rounded opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
            title="New subfolder"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>

      {/* Expanded children */}
      {expanded && (
        <div>
          {loadingChildren && (
            <div style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }} className="py-1">
              <div className="w-3 h-3 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
            </div>
          )}
          {children && children.map(child => (
            <FolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              selectedFolderId={selectedFolderId}
              onFolderSelect={onFolderSelect}
              chapterId={chapterId}
              onFolderCreated={onFolderCreated}
            />
          ))}

          {/* Inline new folder input */}
          {showNewInput && (
            <div style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }} className="py-1 pr-2">
              <div className="flex items-center gap-1.5">
                <FolderIcon />
                <input
                  ref={inputRef}
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={() => {
                    if (!newFolderName.trim() && !creating) {
                      setShowNewInput(false)
                      setError(null)
                    }
                  }}
                  placeholder="Folder name"
                  className="flex-1 min-w-0 px-2 py-0.5 text-sm border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
                  disabled={creating}
                />
                {creating && (
                  <div className="w-3 h-3 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin flex-shrink-0" />
                )}
              </div>
              {error && (
                <p className="text-xs text-red-600 mt-0.5 ml-5">{error}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function FolderTree({ chapterId, selectedFolderId, onFolderSelect }) {
  const [rootFolders, setRootFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewRoot, setShowNewRoot] = useState(false)
  const [newRootName, setNewRootName] = useState('')
  const [creatingRoot, setCreatingRoot] = useState(false)
  const [rootError, setRootError] = useState(null)
  const rootInputRef = useRef(null)

  const fetchRootFolders = useCallback(async () => {
    if (!chapterId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ chapter_id: chapterId })
      const res = await fetch(`/api/folders?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRootFolders(data.folders)
    } catch (err) {
      console.error('Failed to load folders:', err)
    } finally {
      setLoading(false)
    }
  }, [chapterId])

  useEffect(() => {
    fetchRootFolders()
  }, [fetchRootFolders])

  useEffect(() => {
    if (showNewRoot && rootInputRef.current) {
      rootInputRef.current.focus()
    }
  }, [showNewRoot])

  const handleCreateRoot = async () => {
    const trimmed = newRootName.trim()
    if (!trimmed) return

    setCreatingRoot(true)
    setRootError(null)
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, chapter_id: chapterId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      await fetchRootFolders()
      setNewRootName('')
      setShowNewRoot(false)
    } catch (err) {
      setRootError(err.message)
    } finally {
      setCreatingRoot(false)
    }
  }

  const handleRootKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleCreateRoot()
    } else if (e.key === 'Escape') {
      setShowNewRoot(false)
      setNewRootName('')
      setRootError(null)
    }
  }

  if (!chapterId) return null

  return (
    <div className="py-1">
      {/* Header */}
      <div className="flex items-center justify-between px-3 mb-1">
        <span className="text-xs uppercase tracking-wide text-gray-500 font-medium">Folders</span>
        <button
          onClick={() => setShowNewRoot(true)}
          className="p-0.5 text-gray-400 hover:text-gray-600 hover:bg-stone-200 rounded transition-colors"
          title="New folder"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-3">
          <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {rootFolders.map(folder => (
            <FolderNode
              key={folder.id}
              folder={folder}
              depth={0}
              selectedFolderId={selectedFolderId}
              onFolderSelect={onFolderSelect}
              chapterId={chapterId}
              onFolderCreated={fetchRootFolders}
            />
          ))}

          {rootFolders.length === 0 && !showNewRoot && (
            <p className="text-xs text-gray-400 px-3 py-2">No folders yet</p>
          )}

          {/* New root folder input */}
          {showNewRoot && (
            <div className="px-2 py-1">
              <div className="flex items-center gap-1.5">
                <FolderIcon />
                <input
                  ref={rootInputRef}
                  type="text"
                  value={newRootName}
                  onChange={(e) => setNewRootName(e.target.value)}
                  onKeyDown={handleRootKeyDown}
                  onBlur={() => {
                    if (!newRootName.trim() && !creatingRoot) {
                      setShowNewRoot(false)
                      setRootError(null)
                    }
                  }}
                  placeholder="Folder name"
                  className="flex-1 min-w-0 px-2 py-0.5 text-sm border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-labor-red focus:border-labor-red"
                  disabled={creatingRoot}
                />
                {creatingRoot && (
                  <div className="w-3 h-3 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin flex-shrink-0" />
                )}
              </div>
              {rootError && (
                <p className="text-xs text-red-600 mt-0.5 ml-5">{rootError}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
