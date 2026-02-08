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
    const { amount, isRecurring, employer, occupation, fec_attestations } = body

    // Validate FEC compliance data
    if (!employer || !occupation) {
      return NextResponse.json(
        { error: 'Employer and occupation are required for FEC compliance' },
        { status: 400 }
      )
    }

    if (!fec_attestations || !fec_attestations.us_citizen || !fec_attestations.personal_funds ||
        !fec_attestations.own_behalf || !fec_attestations.not_contractor) {
      return NextResponse.json(
        { error: 'All FEC attestations are required' },
        { status: 400 }
      )
    }

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

    // Build checkout session config with FEC compliance data
    const fecMetadata = {
      employer: employer,
      occupation: occupation,
      fec_us_citizen: 'true',
      fec_personal_funds: 'true',
      fec_own_behalf: 'true',
      fec_not_contractor: 'true',
      fec_attested_at: new Date().toISOString(),
    }

    const sessionConfig = {
      customer: stripeCustomerId,
      customer_email: undefined, // Don't set if customer is set
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        member_id: member.id,
        payment_type: isRecurring ? 'recurring' : 'one_time',
        ...fecMetadata,
      },
    }

    // Get or create dedicated Stripe Products for party donations
    // This separates party donations from initiative donations in Stripe reporting
    const getOrCreateProduct = async (id, name, description, type) => {
      try {
        return await stripe.products.retrieve(id)
      } catch (e) {
        return await stripe.products.create({
          id,
          name,
          description,
          metadata: { type, category: 'party_donation' },
        })
      }
    }

    if (isRecurring) {
      // Use a single product for all monthly contributions
      const product = await getOrCreateProduct(
        'prod_party_monthly_contribution',
        'Labor Party Monthly Contribution',
        'Recurring monthly contribution to the Labor Party',
        'recurring'
      )

      // Create a price for this specific amount
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
          type: 'party_donation',
          ...fecMetadata,
        },
      }
    } else {
      // Use a single product for all one-time contributions
      const product = await getOrCreateProduct(
        'prod_party_onetime_contribution',
        'Labor Party Contribution',
        'One-time contribution to the Labor Party',
        'one_time'
      )

      sessionConfig.mode = 'payment'
      sessionConfig.line_items = [
        {
          price_data: {
            currency: 'usd',
            product: product.id,
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ]
      sessionConfig.payment_intent_data = {
        metadata: {
          member_id: member.id,
          type: 'party_donation',
          ...fecMetadata,
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
