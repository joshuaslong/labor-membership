import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'

export async function POST(request) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { endpoint, keys } = await request.json()

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        team_member_id: teamMember.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'team_member_id,endpoint' }
    )

  if (error) {
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { endpoint } = await request.json()

  if (!endpoint) {
    return NextResponse.json({ error: 'Endpoint required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('team_member_id', teamMember.id)
    .eq('endpoint', endpoint)

  return NextResponse.json({ ok: true })
}
