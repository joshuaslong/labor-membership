import Link from 'next/link'
import ChapterSelect from '@/components/ChapterSelect'

/**
 * Recipient selection component with multiple recipient types
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
  return (
    <div className="card rounded-none sm:rounded-lg mx-0">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Recipients</h2>

      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="radio"
            name="recipientType"
            value="my_chapter"
            checked={recipientType === 'my_chapter'}
            onChange={(e) => setRecipientType(e.target.value)}
            className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
          />
          <div>
            <span className="text-sm font-medium text-gray-900">My Chapter</span>
            {adminInfo?.chapters?.name && (
              <span className="text-sm text-gray-500 ml-2">({adminInfo.chapters.name})</span>
            )}
          </div>
        </label>

        {chapters.length > 1 && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="recipientType"
              value="chapter"
              checked={recipientType === 'chapter'}
              onChange={(e) => setRecipientType(e.target.value)}
              className="mt-1 w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-gray-900">Specific Chapter</span>
              {recipientType === 'chapter' && (
                <div className="mt-2">
                  <ChapterSelect
                    chapters={chapters}
                    value={selectedChapterId}
                    onChange={setSelectedChapterId}
                    required
                  />
                </div>
              )}
            </div>
          </label>
        )}

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="radio"
            name="recipientType"
            value="group"
            checked={recipientType === 'group'}
            onChange={(e) => setRecipientType(e.target.value)}
            className="mt-1 w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
          />
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-900">Chapter Group</span>
            <span className="text-sm text-gray-500 ml-2">(e.g., Volunteers, Phone Bank Team)</span>
            {recipientType === 'group' && (
              <div className="mt-2 space-y-2">
                <ChapterSelect
                  chapters={chapters}
                  value={groupChapterId}
                  onChange={handleGroupChapterChange}
                  required
                />
                {groupChapterId && (
                  groupsLoading ? (
                    <p className="text-sm text-gray-500">Loading groups...</p>
                  ) : groups.length === 0 ? (
                    <p className="text-sm text-gray-500">No groups in this chapter. <Link href="/admin/groups" className="text-labor-red hover:underline">Create one</Link></p>
                  ) : (
                    <select
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                      className="input-field"
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
        </label>

        {isSuperAdmin && (
          <>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="recipientType"
                value="all_members"
                checked={recipientType === 'all_members'}
                onChange={(e) => setRecipientType(e.target.value)}
                className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">All Members</span>
                <span className="text-sm text-gray-500 ml-2">(National)</span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="recipientType"
                value="mailing_list"
                checked={recipientType === 'mailing_list'}
                onChange={(e) => setRecipientType(e.target.value)}
                className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Mailing List Only</span>
                <span className="text-sm text-gray-500 ml-2">(Non-member subscribers)</span>
              </div>
            </label>
          </>
        )}
      </div>
    </div>
  )
}
