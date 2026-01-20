import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const LEVEL_COLORS = {
  national: 'bg-labor-red',
  state: 'bg-blue-600',
  county: 'bg-green-600',
  city: 'bg-purple-600',
}
const LEVEL_LABELS = {
  national: 'National',
  state: 'State',
  county: 'County',
  city: 'City',
}

export default async function ChapterDetailPage({ params }) {
  const { id } = await params
  const supabase = createAdminClient()
  const supabaseAuth = await createClient()

  // Check if current user is an admin and if they're a member of this chapter
  const { data: { user } } = await supabaseAuth.auth.getUser()
  let isAdmin = false
  let isMember = false
  let isPrimaryChapter = false

  if (user) {
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single()
    isAdmin = !!adminUser

    // Check if user is a member of this chapter
    const { data: memberRecord } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (memberRecord) {
      const { data: memberChapter } = await supabase
        .from('member_chapters')
        .select('is_primary')
        .eq('member_id', memberRecord.id)
        .eq('chapter_id', id)
        .single()

      if (memberChapter) {
        isMember = true
        isPrimaryChapter = memberChapter.is_primary
      }
    }
  }

  const { data: chapter } = await supabase
    .from('chapters')
    .select('*')
    .eq('id', id)
    .single()

  if (!chapter) notFound()

  // Get parent chapter
  let parent = null
  if (chapter.parent_id) {
    const { data } = await supabase
      .from('chapters')
      .select('id, name, level')
      .eq('id', chapter.parent_id)
      .single()
    parent = data
  }

  // Get child chapters
  const { data: children } = await supabase
    .from('chapters')
    .select('id, name, level')
    .eq('parent_id', id)
    .order('name')

  // Only fetch member counts and member list if admin
  let totalMemberCount = 0
  let directMembers = []

  if (isAdmin) {
    // Get total member count using member_chapters junction table
    // This includes all members in this chapter AND all descendant chapters
    const { data: allChapterIds } = await supabase
      .rpc('get_chapter_descendants', { chapter_uuid: id })

    if (allChapterIds) {
      const descendantIds = allChapterIds.map(c => c.id)
      // Count unique members in member_chapters for this chapter and all descendants
      const { count } = await supabase
        .from('member_chapters')
        .select('member_id', { count: 'exact', head: true })
        .eq('chapter_id', id) // Members directly in THIS chapter (includes inherited)
      totalMemberCount = count || 0
    }

    // Also count members who may only have chapter_id set but not member_chapters
    // (legacy data from before junction table was added)
    if (allChapterIds) {
      const descendantIds = allChapterIds.map(c => c.id)
      const { data: membersWithoutMC } = await supabase
        .from('members')
        .select('id')
        .in('chapter_id', descendantIds)
        .eq('status', 'active')

      // Get member IDs already counted in member_chapters for this chapter
      const { data: memberChapterIds } = await supabase
        .from('member_chapters')
        .select('member_id')
        .eq('chapter_id', id)

      const mcMemberIds = new Set(memberChapterIds?.map(mc => mc.member_id) || [])
      const additionalMembers = membersWithoutMC?.filter(m => !mcMemberIds.has(m.id)).length || 0
      totalMemberCount += additionalMembers
    }

    // Fetch direct members list
    const { data: members } = await supabase
      .from('members')
      .select('*')
      .eq('chapter_id', id)
      .eq('status', 'active')
      .order('last_name')
    directMembers = members || []
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/chapters" className="text-gray-500 hover:text-gray-700 text-sm mb-4 inline-block">
        ← Back to Chapters
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-3 py-1 rounded text-white text-sm ${LEVEL_COLORS[chapter.level]}`}>
              {LEVEL_LABELS[chapter.level] || chapter.level}
            </span>
            <h1 className="text-3xl font-bold text-gray-900">{chapter.name}</h1>
          </div>
          {parent && (
            <p className="text-gray-600">
              Part of <Link href={`/chapters/${parent.id}`} className="text-labor-red hover:underline">{parent.name}</Link>
            </p>
          )}
        </div>
        {isMember ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">
              {isPrimaryChapter ? 'Your Chapter' : 'Member'}
            </span>
          </div>
        ) : (
          <Link href={`/join?chapter=${id}`} className="btn-primary">
            Join This Chapter
          </Link>
        )}
      </div>

      {isAdmin && (
        <div className="grid gap-6 mb-8 md:grid-cols-3">
          <div className="card text-center">
            <div className="text-3xl font-bold text-labor-red">{directMembers?.length || 0}</div>
            <div className="text-gray-600">Direct Members</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-gray-900">{totalMemberCount}</div>
            <div className="text-gray-600">Total Members</div>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-gray-900">{children?.length || 0}</div>
            <div className="text-gray-600">Sub-Chapters</div>
          </div>
        </div>
      )}

      {children && children.length > 0 && (
        <div className="card mb-8">
          <h2 className="text-xl font-bold mb-4">Sub-Chapters</h2>
          <div className="space-y-2">
            {children.map(child => (
              <Link
                key={child.id}
                href={`/chapters/${child.id}`}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
              >
                <span className={`px-2 py-1 rounded text-white text-xs ${LEVEL_COLORS[child.level]}`}>
                  {LEVEL_LABELS[child.level] || child.level}
                </span>
                <span className="font-medium">{child.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Direct Members ({directMembers?.length || 0})</h2>
          {directMembers && directMembers.length > 0 ? (
            <div className="divide-y">
              {directMembers.map(member => (
                <div key={member.id} className="py-3 flex justify-between">
                  <div>
                    <div className="font-medium">{member.first_name} {member.last_name}</div>
                    <div className="text-sm text-gray-500">{member.email}</div>
                  </div>
                  <div className="text-sm text-gray-500">
                    Joined {new Date(member.joined_date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No direct members yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
