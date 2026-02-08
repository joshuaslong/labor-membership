import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { sendAutomatedEmail, formatEmailCurrency } from '@/lib/email-templates'

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
          console.log('FEC Data:', {
            name: `${session.metadata.first_name} ${session.metadata.last_name}`,
            address: `${session.metadata.street_address}, ${session.metadata.city}, ${session.metadata.state} ${session.metadata.zip_code}`,
            employer: session.metadata.employer,
            occupation: session.metadata.occupation,
            fec_attested_at: session.metadata.fec_attested_at,
          })

          // Handle mailing list signup if opted in
          if (session.metadata.join_mailing_list === 'true') {
            // Save to mailing_list table
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

          // Store initiative donation with FEC compliance data
          // If member exists, create payment record
          if (session.metadata.member_id) {
            await supabase.from('payments').insert({
              member_id: session.metadata.member_id,
              stripe_checkout_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent,
              amount_cents: session.amount_total,
              status: 'succeeded',
              payment_type: 'initiative',
              employer: session.metadata.employer || null,
              occupation: session.metadata.occupation || null,
              street_address: session.metadata.street_address || null,
              city: session.metadata.city || null,
              state: session.metadata.state || null,
              zip_code: session.metadata.zip_code || null,
              fec_attested_at: session.metadata.fec_attested_at || null,
            })
          }

          break
        }

        const memberId = session.metadata?.member_id

        if (!memberId) {
          console.error('No member_id in session metadata')
          break
        }

        // Get member info for email
        const { data: member } = await supabase
          .from('members')
          .select('email, first_name')
          .eq('id', memberId)
          .single()

        // Extract FEC compliance data from metadata
        const fecData = {
          employer: session.metadata?.employer || null,
          occupation: session.metadata?.occupation || null,
          fec_attested_at: session.metadata?.fec_attested_at || null,
        }

        if (session.mode === 'subscription') {
          // Subscription payment - create subscription record with FEC data
          const subscription = await stripe.subscriptions.retrieve(session.subscription)

          await supabase.from('member_subscriptions').upsert({
            member_id: memberId,
            stripe_subscription_id: session.subscription,
            stripe_price_id: subscription.items.data[0]?.price?.id,
            amount_cents: session.amount_total,
            status: 'active',
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            employer: fecData.employer,
            occupation: fecData.occupation,
            fec_attested_at: fecData.fec_attested_at,
          }, {
            onConflict: 'stripe_subscription_id',
          })

          // Also create a payment record for the initial payment with FEC data
          await supabase.from('payments').insert({
            member_id: memberId,
            stripe_checkout_session_id: session.id,
            stripe_subscription_id: session.subscription,
            amount_cents: session.amount_total,
            status: 'succeeded',
            payment_type: 'recurring',
            employer: fecData.employer,
            occupation: fecData.occupation,
            fec_attested_at: fecData.fec_attested_at,
          })

          // Send payment receipt email
          if (member?.email) {
            try {
              await sendAutomatedEmail({
                templateKey: 'payment_receipt',
                to: member.email,
                variables: {
                  name: member.first_name || 'Member',
                  amount: formatEmailCurrency(session.amount_total),
                  date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                  payment_type: 'recurring membership dues',
                },
                recipientType: 'member',
                recipientId: memberId,
                relatedId: session.id,
              })
            } catch (emailError) {
              console.error('Failed to send payment receipt email:', emailError)
            }
          }
        } else {
          // One-time payment with FEC data
          await supabase.from('payments').insert({
            member_id: memberId,
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: session.payment_intent,
            amount_cents: session.amount_total,
            status: 'succeeded',
            payment_type: 'one_time',
            employer: fecData.employer,
            occupation: fecData.occupation,
            fec_attested_at: fecData.fec_attested_at,
          })

          // Send payment receipt email
          if (member?.email) {
            try {
              await sendAutomatedEmail({
                templateKey: 'payment_receipt',
                to: member.email,
                variables: {
                  name: member.first_name || 'Member',
                  amount: formatEmailCurrency(session.amount_total),
                  date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                  payment_type: 'one-time donation',
                },
                recipientType: 'member',
                recipientId: memberId,
                relatedId: session.id,
              })
            } catch (emailError) {
              console.error('Failed to send payment receipt email:', emailError)
            }
          }
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

          // Send payment receipt email
          const { data: member } = await supabase
            .from('members')
            .select('email, first_name')
            .eq('id', subscription.member_id)
            .single()

          if (member?.email) {
            try {
              await sendAutomatedEmail({
                templateKey: 'payment_receipt',
                to: member.email,
                variables: {
                  name: member.first_name || 'Member',
                  amount: formatEmailCurrency(invoice.amount_paid),
                  date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                  payment_type: 'recurring membership dues',
                },
                recipientType: 'member',
                recipientId: subscription.member_id,
                relatedId: invoice.id,
              })
            } catch (emailError) {
              console.error('Failed to send payment receipt email:', emailError)
            }
          }
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

          // Get member and send payment failed email
          const { data: subscriptionRecord } = await supabase
            .from('member_subscriptions')
            .select('member_id')
            .eq('stripe_subscription_id', invoice.subscription)
            .single()

          if (subscriptionRecord) {
            const { data: member } = await supabase
              .from('members')
              .select('email, first_name')
              .eq('id', subscriptionRecord.member_id)
              .single()

            if (member?.email) {
              try {
                await sendAutomatedEmail({
                  templateKey: 'payment_failed',
                  to: member.email,
                  variables: {
                    name: member.first_name || 'Member',
                    amount: formatEmailCurrency(invoice.amount_due),
                    update_payment_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
                  },
                  recipientType: 'member',
                  recipientId: subscriptionRecord.member_id,
                  relatedId: invoice.id,
                })
              } catch (emailError) {
                console.error('Failed to send payment failed email:', emailError)
              }
            }
          }
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
