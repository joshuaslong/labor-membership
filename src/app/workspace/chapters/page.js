import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import ChapterBrowser from './ChapterBrowser'

export default async function WorkspaceChaptersPage() {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const supabase = createAdminClient()

  // Fetch all chapters
  const { data: chapters, error } = await supabase
    .from('chapters')
    .select('*')
    .order('level')
    .order('name')

  if (error) {
    console.error('Error fetching chapters:', error)
    throw new Error('Failed to load chapters')
  }

  // Get member counts per chapter
  const { data: memberCounts } = await supabase
    .from('member_chapters')
    .select('chapter_id, members!inner(status)')
    .eq('members.status', 'active')

  const countMap = {}
  memberCounts?.forEach(mc => {
    countMap[mc.chapter_id] = (countMap[mc.chapter_id] || 0) + 1
  })

  const chaptersWithCounts = chapters?.map(c => ({
    ...c,
    memberCount: countMap[c.id] || 0,
  })) || []

  // Team member's chapter info (already joined from getCurrentTeamMember)
  const myChapter = teamMember.chapters || null

  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-4">
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Chapters</h1>
        </div>
        <div className="bg-white border border-stone-200 rounded p-8 text-center text-gray-500">
          Loading chapters...
        </div>
      </div>
    }>
      <ChapterBrowser
        chapters={chaptersWithCounts}
        myChapter={myChapter}
      />
    </Suspense>
  )
}
