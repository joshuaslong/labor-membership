'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

function FolderIcon() {
  return (
    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  )
}

function FolderPickerNode({ folder, depth, selectedId, currentFolderId, onSelect, chapterId }) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState(null)
  const [loadingChildren, setLoadingChildren] = useState(false)

  const hasSubfolders = folder.subfolder_count > 0
  const isSelected = selectedId === folder.id
  const isCurrent = currentFolderId === folder.id

  const fetchChildren = useCallback(async () => {
    if (children !== null) return
    setLoadingChildren(true)
    try {
      const params = new URLSearchParams({ chapter_id: chapterId, parent_id: folder.id })
      const res = await fetch(`/api/folders?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setChildren(data.folders)
    } catch {
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

  return (
    <div>
      <button
        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-left transition-colors ${
          isCurrent
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : isSelected
              ? 'bg-labor-red/10 text-labor-red font-medium'
              : 'text-gray-700 hover:bg-stone-50'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => !isCurrent && onSelect(folder.id)}
        disabled={isCurrent}
      >
        {hasSubfolders ? (
          <span
            onClick={handleToggle}
            className="p-0.5 -ml-1 hover:bg-stone-200 rounded transition-colors flex-shrink-0 cursor-pointer"
          >
            <svg
              className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        ) : (
          <span className="w-3.5 h-3.5 block flex-shrink-0" />
        )}

        <FolderIcon />
        <span className="truncate">{folder.name}</span>
        {isCurrent && <span className="text-xs text-gray-400 ml-auto flex-shrink-0">(current)</span>}
      </button>

      {expanded && (
        <div>
          {loadingChildren && (
            <div style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }} className="py-1">
              <div className="w-3 h-3 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
            </div>
          )}
          {children && children.map(child => (
            <FolderPickerNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              selectedId={selectedId}
              currentFolderId={currentFolderId}
              onSelect={onSelect}
              chapterId={chapterId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function MoveToFolderModal({ fileId, currentFolderId, chapterId, onMove, onClose }) {
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null) // null = root
  const [moving, setMoving] = useState(false)
  const [error, setError] = useState(null)
  const overlayRef = useRef(null)

  // Fetch root folders
  useEffect(() => {
    if (!chapterId) return
    async function load() {
      try {
        const params = new URLSearchParams({ chapter_id: chapterId })
        const res = await fetch(`/api/folders?${params}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setFolders(data.folders)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [chapterId])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleMove = async () => {
    setMoving(true)
    setError(null)
    try {
      const res = await fetch(`/api/files/${fileId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: selectedId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (onMove) onMove(selectedId)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setMoving(false)
    }
  }

  const isRootSelected = selectedId === null
  const isCurrentRoot = !currentFolderId

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <h2 className="text-sm font-semibold text-gray-900">Move to Folder</h2>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Root option */}
              <button
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors ${
                  isCurrentRoot
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : isRootSelected
                      ? 'bg-labor-red/10 text-labor-red font-medium'
                      : 'text-gray-700 hover:bg-stone-50'
                }`}
                onClick={() => !isCurrentRoot && setSelectedId(null)}
                disabled={isCurrentRoot}
              >
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>Root (no folder)</span>
                {isCurrentRoot && <span className="text-xs text-gray-400 ml-auto">(current)</span>}
              </button>

              {/* Folder tree */}
              {folders.map(folder => (
                <FolderPickerNode
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  selectedId={selectedId}
                  currentFolderId={currentFolderId}
                  onSelect={setSelectedId}
                  chapterId={chapterId}
                />
              ))}

              {folders.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">No folders available</p>
              )}
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-5 py-2">
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-stone-200">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-700 border border-stone-200 rounded hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={moving || (isRootSelected && isCurrentRoot) || (selectedId === currentFolderId)}
            className="px-4 py-1.5 text-sm font-medium text-white bg-labor-red hover:bg-labor-red/90 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {moving ? (
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Moving...
              </span>
            ) : (
              'Move'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
