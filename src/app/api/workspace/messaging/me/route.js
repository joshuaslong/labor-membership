import { NextResponse } from 'next/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: member } = await supabase
    .from('members')
    .select('first_name, last_name')
    .eq('user_id', teamMember.user_id)
    .single()

  return NextResponse.json({
    teamMember: {
      id: teamMember.id,
      user_id: teamMember.user_id,
      chapter_id: teamMember.chapter_id,
      roles: teamMember.roles,
      first_name: member?.first_name || null,
      last_name: member?.last_name || null,
    }
  })
}
