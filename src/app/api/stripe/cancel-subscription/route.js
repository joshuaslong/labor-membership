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
      .select('id, stripe_subscription_id')
      .eq('stripe_subscription_id', subscriptionId)
      .eq('member_id', member.id)
      .single()

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or does not belong to you' },
        { status: 404 }
      )
    }

    // Cancel the subscription in Stripe (at period end to give them remaining time)
    const updatedSub = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })

    // Update our record - keep status as 'active' (DB constraint), use cancelled_at to indicate cancelling
    const periodEnd = updatedSub.current_period_end
      ? new Date(updatedSub.current_period_end * 1000).toISOString()
      : null

    await supabase
      .from('member_subscriptions')
      .update({
        status: 'active', // Keep as active - we detect cancelling via cancelled_at field
        cancelled_at: new Date().toISOString(),
        current_period_end: periodEnd,
      })
      .eq('stripe_subscription_id', subscriptionId)

    return NextResponse.json({
      success: true,
      endsAt: periodEnd
    })
  } catch (error) {
    console.error('Cancel subscription error:', error)
    return NextResponse.json(
      { error: 'Unable to process request' },
      { status: 500 }
    )
  }
}
