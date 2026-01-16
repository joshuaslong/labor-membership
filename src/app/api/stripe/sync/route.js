import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Sync a member's Stripe data (subscriptions and payments)
export async function POST(request) {
  try {
    const authClient = await createClient()
    const { data: { user } } = await authClient.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Get member with stripe customer ID
    const { data: member } = await supabase
      .from('members')
      .select('id, stripe_customer_id, email')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    let stripeCustomerId = member.stripe_customer_id
    let syncedSubscriptions = 0
    let syncedPayments = 0

    // If no Stripe customer ID, try to find by email
    if (!stripeCustomerId) {
      const customers = await stripe.customers.list({
        email: member.email,
        limit: 1,
      })

      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id

        // Save customer ID to member record
        await supabase
          .from('members')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('id', member.id)
      }
    }

    if (!stripeCustomerId) {
      return NextResponse.json({
        message: 'No Stripe customer found for this email',
        syncedSubscriptions: 0,
        syncedPayments: 0,
      })
    }

    // Sync subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      limit: 100,
    })

    for (const sub of subscriptions.data) {
      const { error } = await supabase.from('member_subscriptions').upsert({
        member_id: member.id,
        stripe_subscription_id: sub.id,
        stripe_price_id: sub.items.data[0]?.price?.id,
        amount_cents: sub.items.data[0]?.price?.unit_amount || 0,
        status: sub.status === 'canceled' ? 'cancelled' : sub.status,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        cancelled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      }, {
        onConflict: 'stripe_subscription_id',
      })

      if (!error) syncedSubscriptions++
    }

    // Sync payments (charges and payment intents)
    const charges = await stripe.charges.list({
      customer: stripeCustomerId,
      limit: 100,
    })

    for (const charge of charges.data) {
      if (charge.status !== 'succeeded') continue

      // Check if payment already exists
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('member_id', member.id)
        .eq('stripe_payment_intent_id', charge.payment_intent)
        .maybeSingle()

      if (!existing) {
        // Determine if this is a subscription payment
        const isRecurring = charge.invoice !== null

        const { error } = await supabase.from('payments').insert({
          member_id: member.id,
          stripe_payment_intent_id: charge.payment_intent,
          amount_cents: charge.amount,
          status: 'succeeded',
          payment_type: isRecurring ? 'recurring' : 'one_time',
          created_at: new Date(charge.created * 1000).toISOString(),
        })

        if (!error) syncedPayments++
      }
    }

    return NextResponse.json({
      message: 'Sync completed',
      syncedSubscriptions,
      syncedPayments,
      stripeCustomerId,
    })
  } catch (error) {
    console.error('Stripe sync error:', error)
    return NextResponse.json(
      { error: 'Failed to sync Stripe data' },
      { status: 500 }
    )
  }
}
