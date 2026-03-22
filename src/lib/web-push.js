import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/server'

let vapidConfigured = false

function ensureVapid() {
  if (vapidConfigured) return
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    console.warn('VAPID keys not configured — push notifications disabled')
    return
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@votelabor.org',
    publicKey,
    privateKey
  )
  vapidConfigured = true
}

/**
 * Send push notifications for a new message to channel members
 * who have notifications enabled (excluding the sender).
 * Fire-and-forget — errors are logged, never thrown.
 */
export async function sendMessagePushNotifications({
  channelId,
  senderTeamMemberId,
  messageContent,
  parentMessageId,
}) {
  ensureVapid()
  if (!vapidConfigured) return

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

  let targetMemberIds

  if (parentMessageId) {
    // Thread reply: notify thread participants (parent author + other repliers)
    const { data: threadMessages } = await supabase
      .from('messages')
      .select('sender_id')
      .or(`id.eq.${parentMessageId},parent_message_id.eq.${parentMessageId}`)

    if (!threadMessages || threadMessages.length === 0) return

    // Unique participant IDs, excluding the sender
    targetMemberIds = [...new Set(threadMessages.map(m => m.sender_id))]
      .filter(id => id !== senderTeamMemberId)
  } else {
    // Regular channel message: notify channel members with notifications enabled
    const { data: members } = await supabase
      .from('channel_members')
      .select('team_member_id')
      .eq('channel_id', channelId)
      .eq('notifications_enabled', true)
      .neq('team_member_id', senderTeamMemberId)

    if (!members || members.length === 0) return
    targetMemberIds = members.map(m => m.team_member_id)
  }

  if (targetMemberIds.length === 0) return

  // Get push subscriptions for target members
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('team_member_id', targetMemberIds)

  if (!subscriptions || subscriptions.length === 0) return

  const preview = messageContent.length > 100
    ? messageContent.slice(0, 100) + '...'
    : messageContent

  const title = parentMessageId
    ? `Thread in #${channel?.name || 'channel'}`
    : `#${channel?.name || 'channel'}`

  const payload = JSON.stringify({
    title,
    body: `${senderName}: ${preview}`,
    data: {
      url: `/workspace/messaging?channel=${channelId}`,
      channelId,
    },
    tag: parentMessageId ? `thread-${parentMessageId}` : `channel-${channelId}`,
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
