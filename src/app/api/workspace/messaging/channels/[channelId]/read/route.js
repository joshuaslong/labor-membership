import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'

export async function POST(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { channelId } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('channel_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('channel_id', channelId)
    .eq('team_member_id', teamMember.id)
    .select('id')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not a member of this channel' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
