import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const { amount, email, firstName, lastName, joinMailingList, createAccount } = body

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Validate amount
    const amountCents = Math.round(parseFloat(amount) * 100)
    if (amountCents < 100 || amountCents > 1000000) {
      return NextResponse.json(
        { error: 'Amount must be between $1 and $10,000' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Check if this email already has a member account
    const { data: existingMember } = await supabase
      .from('members')
      .select('id, stripe_customer_id')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    let stripeCustomerId = existingMember?.stripe_customer_id

    // Create or get Stripe customer
    if (!stripeCustomerId) {
      // Check if customer exists in Stripe
      const existingCustomers = await stripe.customers.list({
        email: email.toLowerCase(),
        limit: 1,
      })

      if (existingCustomers.data.length > 0) {
        stripeCustomerId = existingCustomers.data[0].id
      } else {
        // Create new Stripe customer
        const customer = await stripe.customers.create({
          email: email.toLowerCase(),
          name: firstName && lastName ? `${firstName} ${lastName}` : undefined,
          metadata: {
            source: 'care-packages-initiative',
            member_id: existingMember?.id || 'guest',
          },
        })
        stripeCustomerId = customer.id
      }

      // Update existing member with Stripe customer ID if they exist
      if (existingMember && !existingMember.stripe_customer_id) {
        await supabase
          .from('members')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('id', existingMember.id)
      }
    }

    // Store donation intent in metadata
    const metadata = {
      initiative: 'care-packages',
      email: email.toLowerCase(),
      first_name: firstName || '',
      last_name: lastName || '',
      join_mailing_list: joinMailingList ? 'true' : 'false',
      create_account: createAccount ? 'true' : 'false',
      member_id: existingMember?.id || '',
    }

    // Create the checkout session
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://members.votelabor.org'

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'payment',
      success_url: `${baseUrl}/initiatives/care-packages/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/initiatives/care-packages`,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'ICE Protestor Care Package Fund',
              description: 'Donation to provide care packages for ICE protestors',
              images: [], // Could add an image URL here
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        metadata,
      },
      metadata,
    })

    return NextResponse.json({ url: session.url, sessionId: session.id })
  } catch (error) {
    console.error('Care packages checkout error:', error)
    return NextResponse.json(
      { error: 'Unable to process request' },
      { status: 500 }
    )
  }
}
