import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function PUT(request, { params }) {
  const { id } = await params
  const { chapter_id } = await request.json()
  const supabase = createAdminClient()

  if (!chapter_id) {
    return NextResponse.json({ error: 'chapter_id is required' }, { status: 400 })
  }

  // Update member's chapter_id
  const { error: updateError } = await supabase
    .from('members')
    .update({ chapter_id })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Delete existing member_chapters records
  await supabase
    .from('member_chapters')
    .delete()
    .eq('member_id', id)

  // Get all chapters to build hierarchy
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, parent_id')

  const chapterMap = {}
  chapters?.forEach(c => { chapterMap[c.id] = c })

  // Build list of chapters (primary + all parents)
  const chapterIds = []
  let currentChapterId = chapter_id
  while (currentChapterId) {
    chapterIds.push(currentChapterId)
    currentChapterId = chapterMap[currentChapterId]?.parent_id
  }

  // Insert new member_chapters records
  const memberChaptersData = chapterIds.map((chapterId, index) => ({
    member_id: id,
    chapter_id: chapterId,
    is_primary: index === 0,
  }))

  if (memberChaptersData.length > 0) {
    const { error: mcError } = await supabase
      .from('member_chapters')
      .insert(memberChaptersData)

    if (mcError) {
      return NextResponse.json({ error: mcError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
