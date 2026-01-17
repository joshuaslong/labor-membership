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

    // NOTE: We only sync charges, not checkout sessions
    // Checkout sessions for subscriptions create invoices which create charges
    // Syncing both would create duplicates
    // The charges loop above is the source of truth for all payments

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error) {
    console.error('Payment sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Clean up duplicate payments
export async function DELETE(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Check if user is super_admin
    const { data: adminUser } = await adminClient
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!adminUser || adminUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
    }

    // Find duplicate payments (same member, same amount, within 5 minutes of each other)
    const { data: allPayments } = await adminClient
      .from('payments')
      .select('id, member_id, amount_cents, created_at, stripe_payment_intent_id, stripe_checkout_session_id')
      .eq('status', 'succeeded')
      .order('created_at', { ascending: true })

    const duplicatesToDelete = []
    const seenPayments = new Map() // key: member_id-amount -> { id, created_at }

    for (const payment of allPayments || []) {
      const key = `${payment.member_id}-${payment.amount_cents}`
      const existing = seenPayments.get(key)

      if (existing) {
        const existingDate = new Date(existing.created_at)
        const currentDate = new Date(payment.created_at)
        const diffMs = Math.abs(currentDate - existingDate)

        // If within 5 minutes, it's likely a duplicate
        if (diffMs < 5 * 60 * 1000) {
          // Keep the one with more Stripe identifiers, delete the other
          const existingHasPI = !!existing.stripe_payment_intent_id
          const currentHasPI = !!payment.stripe_payment_intent_id
          const existingHasCS = !!existing.stripe_checkout_session_id
          const currentHasCS = !!payment.stripe_checkout_session_id

          const existingScore = (existingHasPI ? 1 : 0) + (existingHasCS ? 1 : 0)
          const currentScore = (currentHasPI ? 1 : 0) + (currentHasCS ? 1 : 0)

          if (currentScore > existingScore) {
            // Current is better, delete existing
            duplicatesToDelete.push(existing.id)
            seenPayments.set(key, payment)
          } else {
            // Existing is better or same, delete current
            duplicatesToDelete.push(payment.id)
          }
        } else {
          // Not within time window, update the seen payment
          seenPayments.set(key, payment)
        }
      } else {
        seenPayments.set(key, payment)
      }
    }

    // Delete duplicates
    let deleted = 0
    for (const id of duplicatesToDelete) {
      const { error } = await adminClient
        .from('payments')
        .delete()
        .eq('id', id)

      if (!error) deleted++
    }

    return NextResponse.json({
      success: true,
      duplicatesFound: duplicatesToDelete.length,
      deleted
    })

  } catch (error) {
    console.error('Cleanup error:', error)
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
