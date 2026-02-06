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
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
        Recipients
      </h3>

      <div className="space-y-2">
        {/* My Chapter */}
        <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
          recipientType === 'my_chapter'
            ? 'border-labor-red bg-red-50'
            : 'border-stone-200 hover:border-stone-300 bg-white'
        }`}>
          <input
            type="radio"
            name="recipientType"
            value="my_chapter"
            checked={recipientType === 'my_chapter'}
            onChange={(e) => setRecipientType(e.target.value)}
            className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
          />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium text-gray-900">My Chapter</span>
            {adminInfo?.chapters?.name && (
              <span className="text-sm text-gray-500 ml-1">({adminInfo.chapters.name})</span>
            )}
          </div>
        </label>

        {/* Specific Chapter */}
        {chapters.length > 1 && (
          <div className={`rounded-lg border transition-colors ${
            recipientType === 'chapter'
              ? 'border-labor-red bg-red-50'
              : 'border-stone-200 bg-white'
          }`}>
            <label className="flex items-center gap-3 p-3 cursor-pointer">
              <input
                type="radio"
                name="recipientType"
                value="chapter"
                checked={recipientType === 'chapter'}
                onChange={(e) => setRecipientType(e.target.value)}
                className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
              />
              <span className="text-sm font-medium text-gray-900">Specific Chapter</span>
            </label>
            {recipientType === 'chapter' && (
              <div className="px-3 pb-3 pt-0">
                <ChapterSelect
                  chapters={chapters}
                  value={selectedChapterId}
                  onChange={setSelectedChapterId}
                  required
                />
              </div>
            )}
          </div>
        )}

        {/* Chapter Group */}
        <div className={`rounded-lg border transition-colors ${
          recipientType === 'group'
            ? 'border-labor-red bg-red-50'
            : 'border-stone-200 bg-white'
        }`}>
          <label className="flex items-center gap-3 p-3 cursor-pointer">
            <input
              type="radio"
              name="recipientType"
              value="group"
              checked={recipientType === 'group'}
              onChange={(e) => setRecipientType(e.target.value)}
              className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
            />
            <div>
              <span className="text-sm font-medium text-gray-900">Group</span>
              <span className="text-xs text-gray-500 ml-2">(e.g., Volunteers, Phone Bank)</span>
            </div>
          </label>
          {recipientType === 'group' && (
            <div className="px-3 pb-3 pt-0 space-y-2">
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
                  <p className="text-sm text-gray-500">
                    No groups in this chapter.{' '}
                    <Link href="/admin/groups" className="text-labor-red hover:underline">
                      Create one
                    </Link>
                  </p>
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

        {/* Super Admin Only Options */}
        {isSuperAdmin && (
          <>
            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              recipientType === 'all_members'
                ? 'border-labor-red bg-red-50'
                : 'border-stone-200 hover:border-stone-300 bg-white'
            }`}>
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
                <span className="text-xs text-gray-500 ml-2">(National)</span>
              </div>
            </label>

            <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              recipientType === 'mailing_list'
                ? 'border-labor-red bg-red-50'
                : 'border-stone-200 hover:border-stone-300 bg-white'
            }`}>
              <input
                type="radio"
                name="recipientType"
                value="mailing_list"
                checked={recipientType === 'mailing_list'}
                onChange={(e) => setRecipientType(e.target.value)}
                className="w-4 h-4 text-labor-red border-gray-300 focus:ring-labor-red"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">Mailing List</span>
                <span className="text-xs text-gray-500 ml-2">(Non-member subscribers)</span>
              </div>
            </label>
          </>
        )}
      </div>
    </div>
  )
}
