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
    const { subscriptionId, newAmount } = body

    if (!subscriptionId || !newAmount) {
      return NextResponse.json(
        { error: 'Subscription ID and new amount are required' },
        { status: 400 }
      )
    }

    const amountCents = Math.round(parseFloat(newAmount) * 100)
    if (amountCents < 100 || amountCents > 500000) {
      return NextResponse.json(
        { error: 'Amount must be between $1 and $5,000' },
        { status: 400 }
      )
    }

    // Get member info
    const supabase = createAdminClient()
    const { data: member } = await supabase
      .from('members')
      .select('id, first_name, last_name')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Verify the subscription belongs to this member
    const { data: subscription } = await supabase
      .from('member_subscriptions')
      .select('id, stripe_subscription_id, status, amount_cents')
      .eq('stripe_subscription_id', subscriptionId)
      .eq('member_id', member.id)
      .single()

    if (!subscription) {
      return NextResponse.json(
        { error: 'Subscription not found or does not belong to you' },
        { status: 404 }
      )
    }

    if (subscription.status !== 'active' && subscription.status !== 'cancelling') {
      return NextResponse.json(
        { error: 'Subscription cannot be updated' },
        { status: 400 }
      )
    }

    // Get the current subscription from Stripe
    const stripeSub = await stripe.subscriptions.retrieve(subscriptionId)
    const currentItem = stripeSub.items.data[0]

    // Create a new price for the new amount
    const product = await stripe.products.create({
      name: `Labor Party Monthly Contribution - $${newAmount}`,
      metadata: { member_id: member.id },
    })

    const newPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: amountCents,
      currency: 'usd',
      recurring: { interval: 'month' },
    })

    // Update the subscription with the new price
    const updatedSub = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: currentItem.id,
        price: newPrice.id,
      }],
      // If it was set to cancel, keep it active now that they're updating
      cancel_at_period_end: false,
      proration_behavior: 'create_prorations', // Prorate the difference
    })

    // Update our record
    await supabase
      .from('member_subscriptions')
      .update({
        amount_cents: amountCents,
        stripe_price_id: newPrice.id,
        status: 'active',
        cancelled_at: null,
      })
      .eq('stripe_subscription_id', subscriptionId)

    return NextResponse.json({
      success: true,
      subscription: {
        amount_cents: amountCents,
        status: 'active',
        current_period_end: new Date(updatedSub.current_period_end * 1000).toISOString(),
      }
    })
  } catch (error) {
    console.error('Update subscription error:', error)
    return NextResponse.json(
      { error: 'Unable to process request' },
      { status: 500 }
    )
  }
}
