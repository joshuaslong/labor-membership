import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { syncMailingListSignup } from '@/lib/mailerlite'

// Disable body parsing - we need raw body for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
}

export async function POST(request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  let event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        console.log('=== CHECKOUT COMPLETED ===')
        console.log('Session ID:', session.id)
        console.log('Amount:', session.amount_total / 100)
        console.log('Mode:', session.mode)
        console.log('Metadata:', session.metadata)

        // Check if this is an initiative donation (has initiative field in metadata)
        if (session.metadata?.initiative) {
          console.log('Initiative donation detected:', session.metadata.initiative)

          // Handle mailing list signup if opted in
          if (session.metadata.join_mailing_list === 'true' && process.env.MAILERLITE_API_KEY) {
            const initiativeNames = {
              'care-packages': 'ICE Protestor Care Packages',
            }

            syncMailingListSignup({
              email: session.metadata.email,
              firstName: session.metadata.first_name,
              lastName: session.metadata.last_name,
              source: `initiative-${session.metadata.initiative}`,
              initiativeSlug: session.metadata.initiative,
              initiativeName: initiativeNames[session.metadata.initiative] || session.metadata.initiative,
            }).catch((err) => {
              console.error('MailerLite sync error:', err)
            })

            // Also save to mailing_list table
            await supabase.from('mailing_list').upsert({
              email: session.metadata.email?.toLowerCase(),
              first_name: session.metadata.first_name || null,
              last_name: session.metadata.last_name || null,
              source: `initiative-${session.metadata.initiative}`,
              subscribed: true,
            }, {
              onConflict: 'email',
            })
          }

          // Store initiative donation (optional - could create initiative_donations table)
          // For now, we can track via Stripe metadata
          break
        }

        const memberId = session.metadata?.member_id

        if (!memberId) {
          console.error('No member_id in session metadata')
          break
        }

        if (session.mode === 'subscription') {
          // Subscription payment - create subscription record
          const subscription = await stripe.subscriptions.retrieve(session.subscription)

          await supabase.from('member_subscriptions').upsert({
            member_id: memberId,
            stripe_subscription_id: session.subscription,
            stripe_price_id: subscription.items.data[0]?.price?.id,
            amount_cents: session.amount_total,
            status: 'active',
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          }, {
            onConflict: 'stripe_subscription_id',
          })

          // Also create a payment record for the initial payment
          await supabase.from('payments').insert({
            member_id: memberId,
            stripe_checkout_session_id: session.id,
            stripe_subscription_id: session.subscription,
            amount_cents: session.amount_total,
            status: 'succeeded',
            payment_type: 'recurring',
          })
        } else {
          // One-time payment
          await supabase.from('payments').insert({
            member_id: memberId,
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent,
            amount_cents: session.amount_total,
            status: 'succeeded',
            payment_type: 'one_time',
          })
        }
        break
      }

      case 'invoice.payment_succeeded': {
        // Recurring subscription payment (after the first one)
        const invoice = event.data.object
        console.log('=== RECURRING PAYMENT ===')
        console.log('Invoice ID:', invoice.id)
        console.log('Amount:', invoice.amount_paid / 100)
        console.log('Subscription:', invoice.subscription)

        // Skip if this is the first invoice (handled by checkout.session.completed)
        if (invoice.billing_reason === 'subscription_create') {
          console.log('Skipping - initial subscription handled by checkout')
          break
        }

        // Get member from subscription
        const { data: subscription } = await supabase
          .from('member_subscriptions')
          .select('member_id')
          .eq('stripe_subscription_id', invoice.subscription)
          .single()

        if (subscription) {
          await supabase.from('payments').insert({
            member_id: subscription.member_id,
            stripe_subscription_id: invoice.subscription,
            stripe_payment_intent_id: invoice.payment_intent,
            amount_cents: invoice.amount_paid,
            status: 'succeeded',
            payment_type: 'recurring',
          })

          // Update subscription period
          const stripeSubscription = await stripe.subscriptions.retrieve(invoice.subscription)
          await supabase
            .from('member_subscriptions')
            .update({
              current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
              status: 'active',
            })
            .eq('stripe_subscription_id', invoice.subscription)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        console.log('=== PAYMENT FAILED ===')
        console.log('Invoice ID:', invoice.id)
        console.log('Subscription:', invoice.subscription)

        if (invoice.subscription) {
          await supabase
            .from('member_subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', invoice.subscription)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        console.log('=== SUBSCRIPTION CANCELLED ===')
        console.log('Subscription ID:', subscription.id)

        await supabase
          .from('member_subscriptions')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        console.log('=== SUBSCRIPTION UPDATED ===')
        console.log('Subscription ID:', subscription.id)
        console.log('Status:', subscription.status)

        const statusMap = {
          active: 'active',
          past_due: 'past_due',
          canceled: 'cancelled',
          incomplete: 'incomplete',
          incomplete_expired: 'cancelled',
          unpaid: 'past_due',
        }

        await supabase
          .from('member_subscriptions')
          .update({
            status: statusMap[subscription.status] || subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}
