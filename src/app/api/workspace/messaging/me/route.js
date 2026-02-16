import { NextResponse } from 'next/server'
import { getCurrentTeamMember } from '@/lib/teamMember'

export async function GET() {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    teamMember: {
      id: teamMember.id,
      user_id: teamMember.user_id,
      chapter_id: teamMember.chapter_id,
      roles: teamMember.roles,
    }
  })
}
