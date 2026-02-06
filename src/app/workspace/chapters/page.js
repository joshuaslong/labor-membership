import { createClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const LEVEL_ORDER = ['national', 'state', 'county', 'city']
const LEVEL_COLORS = {
  national: 'bg-labor-red text-white',
  state: 'bg-blue-600 text-white',
  county: 'bg-green-600 text-white',
  city: 'bg-purple-600 text-white',
}
const LEVEL_LABELS = {
  national: 'National',
  state: 'State',
  county: 'County',
  city: 'City',
}

export default async function WorkspaceChaptersPage() {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const supabase = await createClient()

  // Get team member's chapter
  const { data: myChapter } = await supabase
    .from('chapters')
    .select('*')
    .eq('id', teamMember.chapter_id)
    .single()

  // Get all chapters for building hierarchy
  const { data: allChapters } = await supabase
    .from('chapters')
    .select('*')
    .order('level')
    .order('name')

  // Get member counts per chapter
  const { data: memberCounts } = await supabase
    .from('member_chapters')
    .select('chapter_id, is_primary, members!inner(status)')
    .eq('members.status', 'active')

  const countMap = {}
  memberCounts?.forEach(mc => {
    countMap[mc.chapter_id] = (countMap[mc.chapter_id] || 0) + 1
  })

  // Build chapter hierarchy
  const chapterMap = {}
  allChapters?.forEach(c => {
    chapterMap[c.id] = { ...c, memberCount: countMap[c.id] || 0, children: [] }
  })

  // Build parent-child relationships
  allChapters?.forEach(c => {
    if (c.parent_id && chapterMap[c.parent_id]) {
      chapterMap[c.parent_id].children.push(chapterMap[c.id])
    }
  })

  // Sort children by name
  Object.values(chapterMap).forEach(chapter => {
    chapter.children.sort((a, b) => a.name.localeCompare(b.name))
  })

  // Get my chapter with enriched data
  const myChapterEnriched = myChapter ? chapterMap[myChapter.id] : null

  // Get parent chain (breadcrumb)
  const parentChain = []
  if (myChapterEnriched) {
    let current = myChapterEnriched
    while (current.parent_id && chapterMap[current.parent_id]) {
      parentChain.unshift(chapterMap[current.parent_id])
      current = chapterMap[current.parent_id]
    }
  }

  // Get sibling chapters (same parent)
  const siblingChapters = myChapterEnriched?.parent_id
    ? chapterMap[myChapterEnriched.parent_id]?.children.filter(c => c.id !== myChapterEnriched.id) || []
    : []

  // Calculate total members in my chapter's subtree
  const calculateSubtreeMembers = (chapter) => {
    let total = chapter.memberCount || 0
    chapter.children?.forEach(child => {
      total += calculateSubtreeMembers(child)
    })
    return total
  }

  const totalSubtreeMembers = myChapterEnriched ? calculateSubtreeMembers(myChapterEnriched) : 0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Chapters</h1>
      </div>

      {myChapterEnriched ? (
        <div className="space-y-6">
          {/* My Chapter Card */}
          <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-200 bg-stone-50">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Chapter</h2>
            </div>
            <div className="p-4">
              {/* Breadcrumb */}
              {parentChain.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                  {parentChain.map((parent, idx) => (
                    <span key={parent.id} className="flex items-center gap-1">
                      <Link href={`/chapters/${parent.id}`} className="hover:text-labor-red">
                        {parent.name}
                      </Link>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${LEVEL_COLORS[myChapterEnriched.level]}`}>
                    {LEVEL_LABELS[myChapterEnriched.level]}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{myChapterEnriched.name}</h3>
                    {myChapterEnriched.contact_email && (
                      <p className="text-sm text-gray-500">{myChapterEnriched.contact_email}</p>
                    )}
                  </div>
                </div>
                <Link
                  href={`/chapters/${myChapterEnriched.id}`}
                  className="text-sm text-labor-red hover:underline"
                >
                  View Details
                </Link>
              </div>

              {/* Stats Row */}
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-stone-50 rounded">
                  <div className="text-xl font-semibold text-gray-900">{myChapterEnriched.memberCount}</div>
                  <div className="text-xs text-gray-500">Direct Members</div>
                </div>
                <div className="text-center p-3 bg-stone-50 rounded">
                  <div className="text-xl font-semibold text-gray-900">{totalSubtreeMembers}</div>
                  <div className="text-xs text-gray-500">Total Members</div>
                </div>
                <div className="text-center p-3 bg-stone-50 rounded">
                  <div className="text-xl font-semibold text-gray-900">{myChapterEnriched.children.length}</div>
                  <div className="text-xs text-gray-500">Sub-Chapters</div>
                </div>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Sub-Chapters */}
            <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Sub-Chapters
                </h2>
                <span className="text-xs text-gray-400">{myChapterEnriched.children.length}</span>
              </div>
              <div className="divide-y divide-stone-100">
                {myChapterEnriched.children.length > 0 ? (
                  myChapterEnriched.children.map(child => (
                    <Link
                      key={child.id}
                      href={`/chapters/${child.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[child.level]}`}>
                          {LEVEL_LABELS[child.level]?.charAt(0)}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{child.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{child.memberCount} members</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    No sub-chapters
                  </div>
                )}
              </div>
            </div>

            {/* Sibling Chapters */}
            <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Related Chapters
                </h2>
                <span className="text-xs text-gray-400">{siblingChapters.length}</span>
              </div>
              <div className="divide-y divide-stone-100">
                {siblingChapters.length > 0 ? (
                  siblingChapters.slice(0, 10).map(sibling => (
                    <Link
                      key={sibling.id}
                      href={`/chapters/${sibling.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${LEVEL_COLORS[sibling.level]}`}>
                          {LEVEL_LABELS[sibling.level]?.charAt(0)}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{sibling.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{sibling.memberCount} members</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-gray-500">
                    No sibling chapters
                  </div>
                )}
                {siblingChapters.length > 10 && (
                  <div className="px-4 py-2 text-center">
                    <Link href="/chapters" className="text-xs text-labor-red hover:underline">
                      View all {siblingChapters.length} chapters
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Browse All Link */}
          <div className="text-center">
            <Link
              href="/chapters"
              className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-labor-red"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Browse All Chapters
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-lg p-8 text-center">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No Chapter Assigned</h2>
          <p className="text-sm text-gray-500 mb-4">
            You haven't been assigned to a chapter yet.
          </p>
          <Link href="/chapters" className="btn-primary">
            Browse Chapters
          </Link>
        </div>
      )}
    </div>
  )
}
