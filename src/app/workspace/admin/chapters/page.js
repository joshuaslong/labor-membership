import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const levelColors = {
  national: 'text-red-700 bg-red-50 border-red-200',
  state: 'text-blue-700 bg-blue-50 border-blue-200',
  county: 'text-green-700 bg-green-50 border-green-200',
  city: 'text-amber-700 bg-amber-50 border-amber-200',
}

export default async function ChaptersPage() {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const supabase = createAdminClient()

  const { data: rawChapters } = await supabase
    .from('chapters')
    .select('*')
    .order('level')
    .order('name')

  // Get member counts — fetch all rows (default limit is 1000 which truncates)
  let allMemberChapters = []
  let from = 0
  const batchSize = 1000 // PostgREST server caps at 1000 rows per request
  while (true) {
    const { data: batch } = await supabase
      .from('member_chapters')
      .select('chapter_id, is_primary, members!inner(status)')
      .eq('members.status', 'active')
      .range(from, from + batchSize - 1)

    if (!batch || batch.length === 0) break
    allMemberChapters.push(...batch)
    if (batch.length < batchSize) break
    from += batchSize
  }

  const countMap = {}
  const primaryCountMap = {}
  allMemberChapters.forEach(mc => {
    countMap[mc.chapter_id] = (countMap[mc.chapter_id] || 0) + 1
    if (mc.is_primary) {
      primaryCountMap[mc.chapter_id] = (primaryCountMap[mc.chapter_id] || 0) + 1
    }
  })

  const chapters = (rawChapters || []).map(c => ({
    ...c,
    memberCount: countMap[c.id] || 0,
    primaryCount: primaryCountMap[c.id] || 0,
  }))

  // Build tree structure
  const chapterMap = new Map()
  chapters.forEach(c => chapterMap.set(c.id, { ...c, children: [] }))

  const roots = []
  chapters.forEach(c => {
    if (c.parent_id && chapterMap.has(c.parent_id)) {
      chapterMap.get(c.parent_id).children.push(chapterMap.get(c.id))
    } else if (!c.parent_id) {
      roots.push(chapterMap.get(c.id))
    }
  })

  // Flatten tree in order for display
  function flattenTree(nodes, depth = 0) {
    const result = []
    for (const node of nodes) {
      result.push({ ...node, depth })
      if (node.children?.length > 0) {
        result.push(...flattenTree(node.children, depth + 1))
      }
    }
    return result
  }

  const flatChapters = flattenTree(roots)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Chapters</h1>
          <p className="text-xs text-gray-500 mt-0.5">{chapters.length} {chapters.length === 1 ? 'chapter' : 'chapters'}</p>
        </div>
        <Link
          href="/workspace/admin/chapters/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-labor-red hover:bg-red-700 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chapter
        </Link>
      </div>

      {flatChapters.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded p-12 text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
          </svg>
          <p className="text-sm text-gray-500 mb-1">No chapters found</p>
          <Link href="/workspace/admin/chapters/new" className="text-sm text-labor-red hover:underline">
            Create your first chapter
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded divide-y divide-stone-100">
          {flatChapters.map(chapter => (
            <div
              key={chapter.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              style={{ paddingLeft: `${16 + chapter.depth * 24}px` }}
            >
              {/* Depth indicator */}
              {chapter.depth > 0 && (
                <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 12 12">
                  <path d="M2 0v8h8" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
              )}

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{chapter.name}</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${levelColors[chapter.level] || 'text-gray-700 bg-stone-50 border-stone-200'}`}>
                    {chapter.level}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {chapter.state_code && (
                    <span className="text-xs text-gray-400">{chapter.state_code}</span>
                  )}
                  {chapter.contact_email && (
                    <>
                      {chapter.state_code && <span className="text-xs text-gray-300">·</span>}
                      <span className="text-xs text-gray-400">{chapter.contact_email}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Member counts */}
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-medium text-gray-900 tabular-nums">{chapter.memberCount}</div>
                <div className="text-xs text-gray-400">
                  {chapter.primaryCount !== chapter.memberCount
                    ? `${chapter.primaryCount} direct`
                    : 'members'
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Hierarchy Legend */}
      <div className="mt-4 flex items-center gap-3 text-xs text-gray-400">
        <span>Hierarchy:</span>
        {['national', 'state', 'county', 'city'].map((level, i) => (
          <span key={level} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-300">→</span>}
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium border ${levelColors[level]}`}>
              {level}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
