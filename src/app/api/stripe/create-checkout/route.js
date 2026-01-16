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
    const { amount, isRecurring } = body

    // Validate amount
    const amountCents = Math.round(parseFloat(amount) * 100)
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
      .select('id, email, first_name, last_name, stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Get or create Stripe customer
    let stripeCustomerId = member.stripe_customer_id

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: member.email,
        name: `${member.first_name} ${member.last_name}`,
        metadata: {
          member_id: member.id,
        },
      })
      stripeCustomerId = customer.id

      // Save customer ID to member record
      await supabase
        .from('members')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', member.id)
    }

    // Hardcode the URL to avoid any env variable issues
    const baseUrl = 'https://members.votelabor.org'

    const successUrl = `${baseUrl}/dashboard/contribute/success?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${baseUrl}/dashboard/contribute`

    console.log('Stripe checkout URLs:', { successUrl, cancelUrl })

    // Build checkout session config
    const sessionConfig = {
      customer: stripeCustomerId,
      customer_email: undefined, // Don't set if customer is set
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        member_id: member.id,
        payment_type: isRecurring ? 'recurring' : 'one_time',
      },
    }

    if (isRecurring) {
      // Create a product and price for the subscription
      const product = await stripe.products.create({
        name: `Labor Party Monthly Contribution - $${amount}`,
        metadata: { member_id: member.id },
      })

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: amountCents,
        currency: 'usd',
        recurring: { interval: 'month' },
      })

      sessionConfig.mode = 'subscription'
      sessionConfig.line_items = [{ price: price.id, quantity: 1 }]
      sessionConfig.subscription_data = {
        metadata: {
          member_id: member.id,
        },
      }
    } else {
      // One-time payment
      sessionConfig.mode = 'payment'
      sessionConfig.line_items = [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Labor Party Contribution',
              description: 'One-time contribution',
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ]
      sessionConfig.payment_intent_data = {
        metadata: {
          member_id: member.id,
        },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionConfig)

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (error) {
    console.error('Stripe checkout error:', error)
    return NextResponse.json(
      { error: 'Unable to process request' },
      { status: 500 }
    )
  }
}
