import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

// POST - Sync all Stripe payments to database
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Check if user is super_admin or national_admin
    const { data: adminUser } = await adminClient
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!adminUser || !['super_admin', 'national_admin'].includes(adminUser.role)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const results = {
      totalCharges: 0,
      newPayments: 0,
      updatedPayments: 0,
      unmatchedPayments: 0,
      errors: []
    }

    // Get all members with their email and stripe_customer_id
    const { data: members } = await adminClient
      .from('members')
      .select('id, email, stripe_customer_id')

    // Create a map of email -> member_id for matching
    const emailToMember = {}
    const stripeIdToMember = {}
    members?.forEach(m => {
      if (m.email) emailToMember[m.email.toLowerCase()] = m.id
      if (m.stripe_customer_id) stripeIdToMember[m.stripe_customer_id] = m.id
    })

    // Fetch all successful charges from Stripe
    let hasMore = true
    let startingAfter = null

    while (hasMore) {
      const params = {
        limit: 100,
        expand: ['data.customer'],
      }
      if (startingAfter) {
        params.starting_after = startingAfter
      }

      const charges = await stripe.charges.list(params)
      results.totalCharges += charges.data.length

      for (const charge of charges.data) {
        if (charge.status !== 'succeeded') continue

        // Try to find member by stripe customer ID or email
        let memberId = null
        if (charge.customer) {
          const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer.id
          memberId = stripeIdToMember[customerId]

          // If not found by ID, try to get customer email
          if (!memberId && typeof charge.customer === 'object' && charge.customer.email) {
            memberId = emailToMember[charge.customer.email.toLowerCase()]
          }
        }

        // Also try receipt_email
        if (!memberId && charge.receipt_email) {
          memberId = emailToMember[charge.receipt_email.toLowerCase()]
        }

        // Also try billing_details email
        if (!memberId && charge.billing_details?.email) {
          memberId = emailToMember[charge.billing_details.email.toLowerCase()]
        }

        if (!memberId) {
          results.unmatchedPayments++
          results.errors.push({
            charge_id: charge.id,
            amount: charge.amount / 100,
            email: charge.receipt_email || charge.billing_details?.email || 'unknown',
            error: 'Could not match to a member'
          })
          continue
        }

        // Check if payment already exists by payment_intent OR by member+amount+date combo
        if (charge.payment_intent) {
          const { data: existing } = await adminClient
            .from('payments')
            .select('id')
            .eq('stripe_payment_intent_id', charge.payment_intent)
            .maybeSingle()

          if (existing) {
            results.updatedPayments++
            continue
          }
        }

        // Also check by checkout session if available in metadata
        if (charge.metadata?.checkout_session_id) {
          const { data: existingBySession } = await adminClient
            .from('payments')
            .select('id')
            .eq('stripe_checkout_session_id', charge.metadata.checkout_session_id)
            .maybeSingle()

          if (existingBySession) {
            results.updatedPayments++
            continue
          }
        }

        // Check by member_id + amount + approximate date (within 1 minute)
        const chargeDate = new Date(charge.created * 1000)
        const minDate = new Date(chargeDate.getTime() - 60000).toISOString()
        const maxDate = new Date(chargeDate.getTime() + 60000).toISOString()

        const { data: existingByAmountDate } = await adminClient
          .from('payments')
          .select('id')
          .eq('member_id', memberId)
          .eq('amount_cents', charge.amount)
          .gte('created_at', minDate)
          .lte('created_at', maxDate)
          .maybeSingle()

        if (existingByAmountDate) {
          results.updatedPayments++
          continue
        }

        // Insert new payment
        const isRecurring = charge.invoice !== null
        const { error } = await adminClient.from('payments').insert({
          member_id: memberId,
          stripe_payment_intent_id: charge.payment_intent,
          amount_cents: charge.amount,
          status: 'succeeded',
          payment_type: isRecurring ? 'recurring' : 'one_time',
          created_at: new Date(charge.created * 1000).toISOString(),
        })

        if (error) {
          results.errors.push({
            charge_id: charge.id,
            error: error.message
          })
        } else {
          results.newPayments++
        }
      }

      hasMore = charges.has_more
      if (charges.data.length > 0) {
        startingAfter = charges.data[charges.data.length - 1].id
      }
    }

    // Also sync checkout sessions that might have been missed
    let sessionHasMore = true
    let sessionStartingAfter = null

    while (sessionHasMore) {
      const params = {
        limit: 100,
        expand: ['data.line_items'],
      }
      if (sessionStartingAfter) {
        params.starting_after = sessionStartingAfter
      }

      const sessions = await stripe.checkout.sessions.list(params)

      for (const session of sessions.data) {
        if (session.payment_status !== 'paid') continue
        if (!session.metadata?.member_id) continue

        // Check if we already have this checkout session
        const { data: existing } = await adminClient
          .from('payments')
          .select('id')
          .eq('stripe_checkout_session_id', session.id)
          .maybeSingle()

        if (existing) continue

        // Also check by payment intent
        if (session.payment_intent) {
          const { data: existingByPI } = await adminClient
            .from('payments')
            .select('id')
            .eq('stripe_payment_intent_id', session.payment_intent)
            .maybeSingle()

          if (existingByPI) continue
        }

        // Verify member exists
        const { data: member } = await adminClient
          .from('members')
          .select('id')
          .eq('id', session.metadata.member_id)
          .maybeSingle()

        if (!member) {
          results.unmatchedPayments++
          continue
        }

        // Insert payment
        const { error } = await adminClient.from('payments').insert({
          member_id: session.metadata.member_id,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent,
          amount_cents: session.amount_total,
          status: 'succeeded',
          payment_type: session.mode === 'subscription' ? 'recurring' : 'one_time',
          created_at: new Date(session.created * 1000).toISOString(),
        })

        if (!error) {
          results.newPayments++
        }
      }

      sessionHasMore = sessions.has_more
      if (sessions.data.length > 0) {
        sessionStartingAfter = sessions.data[sessions.data.length - 1].id
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Payment sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET - Get current payment totals for debugging
export async function GET(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Check if user is admin
    const { data: adminUser } = await adminClient
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!adminUser) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get all payments
    const { data: payments } = await adminClient
      .from('payments')
      .select('id, member_id, amount_cents, status, payment_type, created_at')
      .order('created_at', { ascending: false })

    const stats = {
      total: payments?.length || 0,
      succeeded: 0,
      pending: 0,
      failed: 0,
      totalRevenue: 0,
      payments: payments?.slice(0, 20) || [] // Return last 20 for debugging
    }

    payments?.forEach(p => {
      stats[p.status] = (stats[p.status] || 0) + 1
      if (p.status === 'succeeded') {
        stats.totalRevenue += p.amount_cents
      }
    })

    stats.totalRevenue = stats.totalRevenue / 100

    return NextResponse.json(stats)

  } catch (error) {
    console.error('Payment stats error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
