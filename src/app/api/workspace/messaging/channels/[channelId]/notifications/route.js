import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'

export async function GET(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { channelId } = await params
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('channel_members')
    .select('notifications_enabled')
    .eq('channel_id', channelId)
    .eq('team_member_id', teamMember.id)
    .single()

  return NextResponse.json({
    notifications_enabled: data?.notifications_enabled ?? false,
  })
}

export async function PUT(request, { params }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { channelId } = await params
  const { enabled } = await request.json()

  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('channel_members')
    .update({ notifications_enabled: enabled })
    .eq('channel_id', channelId)
    .eq('team_member_id', teamMember.id)
    .select('notifications_enabled')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not a member of this channel' }, { status: 400 })
  }

  return NextResponse.json({ notifications_enabled: data.notifications_enabled })
}
