import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/server'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:admin@votelabor.org',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

/**
 * Send push notifications for a new message to channel members
 * who have notifications enabled (excluding the sender).
 * Fire-and-forget — errors are logged, never thrown.
 */
export async function sendMessagePushNotifications({
  channelId,
  senderTeamMemberId,
  messageContent,
}) {
  const supabase = createAdminClient()

  // Get channel name
  const { data: channel } = await supabase
    .from('channels')
    .select('name')
    .eq('id', channelId)
    .single()

  // Get sender name
  const { data: senderTm } = await supabase
    .from('team_members')
    .select('member_id')
    .eq('id', senderTeamMemberId)
    .single()

  let senderName = 'Someone'
  if (senderTm?.member_id) {
    const { data: member } = await supabase
      .from('members')
      .select('first_name, last_name')
      .eq('id', senderTm.member_id)
      .single()
    if (member) {
      senderName = [member.first_name, member.last_name].filter(Boolean).join(' ') || 'Someone'
    }
  }

  // Get channel members with notifications enabled (excluding sender)
  const { data: members } = await supabase
    .from('channel_members')
    .select('team_member_id')
    .eq('channel_id', channelId)
    .eq('notifications_enabled', true)
    .neq('team_member_id', senderTeamMemberId)

  if (!members || members.length === 0) return

  // Get push subscriptions for those members
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('team_member_id', members.map(m => m.team_member_id))

  if (!subscriptions || subscriptions.length === 0) return

  const preview = messageContent.length > 100
    ? messageContent.slice(0, 100) + '...'
    : messageContent

  const payload = JSON.stringify({
    title: `#${channel?.name || 'channel'}`,
    body: `${senderName}: ${preview}`,
    data: {
      url: `/workspace/messaging?channel=${channelId}`,
      channelId,
    },
    tag: `channel-${channelId}`,
  })

  const staleIds = []

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          staleIds.push(sub.id)
        } else {
          console.error('Push failed:', err.statusCode, err.message)
        }
      }
    })
  )

  // Clean up expired subscriptions
  if (staleIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds)
  }
}
