import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createAdminClient()

  const { data: chapters, error } = await supabase
    .from('chapters')
    .select('*')
    .order('level')
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get member counts per chapter from junction table
  const { data: memberCounts } = await supabase
    .from('member_chapters')
    .select('chapter_id, is_primary, members!inner(status)')
    .eq('members.status', 'active')

  // Count total members and primary (direct) members per chapter
  const countMap = {}
  const primaryCountMap = {}
  memberCounts?.forEach(mc => {
    countMap[mc.chapter_id] = (countMap[mc.chapter_id] || 0) + 1
    if (mc.is_primary) {
      primaryCountMap[mc.chapter_id] = (primaryCountMap[mc.chapter_id] || 0) + 1
    }
  })

  // Add counts to chapters
  const chaptersWithCounts = chapters?.map(c => ({
    ...c,
    memberCount: countMap[c.id] || 0,
    primaryCount: primaryCountMap[c.id] || 0
  }))

  return NextResponse.json({ chapters: chaptersWithCounts })
}

export async function POST(request) {
  const data = await request.json()
  const supabase = createAdminClient()

  const { data: chapter, error } = await supabase
    .from('chapters')
    .insert({
      name: data.name,
      level: data.level,
      parent_id: data.parent_id || null,
      state_code: data.state_code || null,
      county_name: data.county_name || null,
      city_name: data.city_name || null,
      contact_email: data.contact_email || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ chapter }, { status: 201 })
}
