import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request) {
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { subscriptionId } = body

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      )
    }

    // Get member info
    const supabase = createAdminClient()
    const { data: member } = await supabase
      .from('members')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Verify the subscription belongs to this member
    const { data: subscription } = await supabase
      .from('member_subscriptions')
      .select('id, stripe_subscription_id, status, cancelled_at')
      .eq('stripe_subscription_id', subscriptionId)
      .eq('member_id', member.id)
      .single()

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or does not belong to you' },
        { status: 404 }
      )
    }

    // Can only restore if it's in "cancelling" state (status is active but cancelled_at is set)
    const isCancelling = subscription.status === 'active' && subscription.cancelled_at
    console.log('Restore check - status:', subscription.status, 'cancelled_at:', subscription.cancelled_at, 'isCancelling:', isCancelling)

    if (!isCancelling) {
      return NextResponse.json(
        { error: 'Subscription cannot be restored' },
        { status: 400 }
      )
    }

    console.log('Attempting to restore Stripe subscription:', subscriptionId)

    // Restore the subscription in Stripe
    const updatedSub = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    })

    console.log('Stripe subscription restored, updating DB')

    // Update our record
    await supabase
      .from('member_subscriptions')
      .update({
        status: 'active',
        cancelled_at: null,
      })
      .eq('stripe_subscription_id', subscriptionId)

    // Safely convert period end
    const periodEnd = updatedSub.current_period_end
      ? new Date(updatedSub.current_period_end * 1000).toISOString()
      : null

    return NextResponse.json({
      success: true,
      subscription: {
        status: 'active',
        current_period_end: periodEnd,
      }
    })
  } catch (error) {
    console.error('Restore subscription error:', error)
    return NextResponse.json(
      { error: 'Unable to process request' },
      { status: 500 }
    )
  }
}
