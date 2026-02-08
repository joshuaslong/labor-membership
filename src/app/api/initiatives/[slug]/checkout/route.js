import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request, { params }) {
  try {
    const { slug } = await params
    const body = await request.json()
    const {
      amount,
      email,
      firstName,
      lastName,
      streetAddress,
      city,
      state,
      zipCode,
      employer,
      occupation,
      fec_attestations,
      joinMailingList,
      createAccount
    } = body

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // FEC compliance validation
    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'Full name is required for FEC compliance' }, { status: 400 })
    }

    if (!streetAddress || !city || !state || !zipCode) {
      return NextResponse.json({ error: 'Complete mailing address is required for FEC compliance' }, { status: 400 })
    }

    if (!employer || !occupation) {
      return NextResponse.json({ error: 'Employer and occupation are required for FEC compliance' }, { status: 400 })
    }

    if (!fec_attestations || !fec_attestations.us_citizen || !fec_attestations.personal_funds ||
        !fec_attestations.own_behalf || !fec_attestations.not_contractor) {
      return NextResponse.json({ error: 'All FEC attestations are required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get initiative details
    const { data: initiative, error: initiativeError } = await supabase
      .from('initiatives')
      .select('id, slug, title, min_amount, status')
      .eq('slug', slug)
      .eq('status', 'active')
      .single()

    if (initiativeError || !initiative) {
      return NextResponse.json({ error: 'Initiative not found or not active' }, { status: 404 })
    }

    // Validate amount
    const amountCents = Math.round(parseFloat(amount) * 100)
    const minAmount = (initiative.min_amount || 1) * 100
    if (amountCents < minAmount || amountCents > 1000000) {
      return NextResponse.json(
        { error: `Amount must be between $${initiative.min_amount || 1} and $10,000` },
        { status: 400 }
      )
    }

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
        // Update customer with FEC info
        await stripe.customers.update(stripeCustomerId, {
          name: `${firstName} ${lastName}`,
          address: {
            line1: streetAddress,
            city: city,
            state: state,
            postal_code: zipCode,
            country: 'US',
          },
          metadata: {
            employer: employer,
            occupation: occupation,
          },
        })
      } else {
        // Create new Stripe customer with FEC-required address info
        const customer = await stripe.customers.create({
          email: email.toLowerCase(),
          name: `${firstName} ${lastName}`,
          address: {
            line1: streetAddress,
            city: city,
            state: state,
            postal_code: zipCode,
            country: 'US',
          },
          metadata: {
            source: `initiative-${slug}`,
            member_id: existingMember?.id || 'guest',
            employer: employer,
            occupation: occupation,
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

    // Store donation intent in metadata with FEC compliance data
    const metadata = {
      initiative: slug,
      initiative_id: initiative.id,
      email: email.toLowerCase(),
      first_name: firstName,
      last_name: lastName,
      street_address: streetAddress,
      city: city,
      state: state,
      zip_code: zipCode,
      employer: employer,
      occupation: occupation,
      fec_us_citizen: 'true',
      fec_personal_funds: 'true',
      fec_own_behalf: 'true',
      fec_not_contractor: 'true',
      fec_attested_at: new Date().toISOString(),
      join_mailing_list: joinMailingList ? 'true' : 'false',
      create_account: createAccount ? 'true' : 'false',
      member_id: existingMember?.id || '',
    }

    // Create the checkout session
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://members.votelabor.org'

    // Get or create a dedicated Stripe Product for this initiative
    const productId = `prod_initiative_${slug.replace(/-/g, '_')}`
    let product
    try {
      product = await stripe.products.retrieve(productId)
    } catch (e) {
      // Product doesn't exist, create it
      product = await stripe.products.create({
        id: productId,
        name: initiative.title,
        description: `Donations to ${initiative.title}`,
        metadata: {
          type: 'initiative',
          initiative_slug: slug,
          initiative_id: initiative.id,
        },
      })
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'payment',
      success_url: `${baseUrl}/initiatives/${slug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/initiatives/${slug}`,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product: product.id,
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
    console.error('Initiative checkout error:', error)
    return NextResponse.json(
      { error: 'Unable to process request' },
      { status: 500 }
    )
  }
}
