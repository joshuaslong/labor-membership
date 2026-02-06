import Link from 'next/link'
import ChapterSelect from '@/components/ChapterSelect'

/**
 * Recipient selection component - compact version
 */
export default function RecipientSelector({
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
  adminInfo,
  chapters,
  isSuperAdmin
}) {
  // Build recipient options
  const options = [
    { value: 'my_chapter', label: 'My Chapter', sublabel: adminInfo?.chapters?.name },
    ...(chapters.length > 1 ? [{ value: 'chapter', label: 'Specific Chapter' }] : []),
    { value: 'group', label: 'Group' },
    ...(isSuperAdmin ? [
      { value: 'all_members', label: 'All Members' },
      { value: 'mailing_list', label: 'Mailing List' }
    ] : [])
  ]

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Recipients
      </h3>

      <div className="space-y-2">
        {/* Main recipient type selector */}
        <select
          value={recipientType}
          onChange={(e) => setRecipientType(e.target.value)}
          className="input-field text-sm"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}{opt.sublabel ? ` (${opt.sublabel})` : ''}
            </option>
          ))}
        </select>

        {/* Chapter selector (when specific chapter is selected) */}
        {recipientType === 'chapter' && chapters.length > 1 && (
          <ChapterSelect
            chapters={chapters}
            value={selectedChapterId}
            onChange={setSelectedChapterId}
            required
          />
        )}

        {/* Group selector */}
        {recipientType === 'group' && (
          <div className="space-y-2">
            <ChapterSelect
              chapters={chapters}
              value={groupChapterId}
              onChange={handleGroupChapterChange}
              required
              placeholder="Select chapter..."
            />
            {groupChapterId && (
              groupsLoading ? (
                <p className="text-xs text-gray-500">Loading groups...</p>
              ) : groups.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No groups in this chapter.{' '}
                  <Link href="/admin/groups" className="text-labor-red hover:underline">
                    Create one
                  </Link>
                </p>
              ) : (
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="input-field text-sm"
                >
                  <option value="">Select group...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.member_count} member{g.member_count !== 1 ? 's' : ''})
                    </option>
                  ))}
                </select>
              )
            )}
          </div>
        )}
      </div>
    </div>
  )
}
