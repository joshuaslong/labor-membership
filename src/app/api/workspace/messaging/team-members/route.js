import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { isAdmin } from '@/lib/permissions'

export async function GET(request) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isAdmin(teamMember.roles)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const url = new URL(request.url)
  const search = url.searchParams.get('search') || ''
  const chapterId = url.searchParams.get('chapter_id')

  if (search.length < 2) {
    return NextResponse.json([])
  }

  const supabase = createAdminClient()

  // Find team members in this chapter matching the search
  let query = supabase
    .from('team_members')
    .select('id, chapter_id, roles, members(first_name, last_name)')
    .eq('active', true)
    .limit(20)

  if (chapterId) {
    query = query.eq('chapter_id', chapterId)
  }

  const { data: members, error } = await query

  if (error) {
    return NextResponse.json({ error: 'Failed to search team members' }, { status: 500 })
  }

  // Filter by search term on the joined member names
  const searchLower = search.toLowerCase()
  const filtered = (members || [])
    .filter(m => {
      const name = `${m.members?.first_name || ''} ${m.members?.last_name || ''}`.toLowerCase()
      return name.includes(searchLower)
    })
    .map(m => ({
      id: m.id,
      first_name: m.members?.first_name ?? '',
      last_name: m.members?.last_name ?? '',
    }))

  return NextResponse.json(filtered)
}
