import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

async function getAdminRoles(adminClient, userId) {
  // Check team_members first, then fall back to admin_users
  const { data: teamMembers } = await adminClient
    .from('team_members')
    .select('roles')
    .eq('user_id', userId)
    .eq('active', true)

  // Combine roles from all active team_member records
  const tmRoles = (teamMembers || []).flatMap(tm => tm.roles || [])
  if (tmRoles.length > 0) return [...new Set(tmRoles)]

  // Fall back to admin_users (user may have multiple records)
  const { data: adminUsers } = await adminClient
    .from('admin_users')
    .select('role')
    .eq('user_id', userId)

  return (adminUsers || []).map(a => a.role)
}

// POST - Sync all Stripe payments to database
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const roles = await getAdminRoles(adminClient, user.id)
    if (!roles.some(r => ['super_admin', 'national_admin'].includes(r))) {
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

        // Check if payment already exists by charge ID (most reliable)
        const { data: existingByCharge } = await adminClient
          .from('payments')
          .select('id')
          .eq('stripe_charge_id', charge.id)
          .maybeSingle()

        if (existingByCharge) {
          results.updatedPayments++
          continue
        }

        // Also check by payment_intent if available
        if (charge.payment_intent) {
          const { data: existing } = await adminClient
            .from('payments')
            .select('id')
            .eq('stripe_payment_intent_id', charge.payment_intent)
            .maybeSingle()

          if (existing) {
            // Update with charge_id if missing
            await adminClient
              .from('payments')
              .update({ stripe_charge_id: charge.id })
              .eq('id', existing.id)
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
            // Update with charge_id if missing
            await adminClient
              .from('payments')
              .update({ stripe_charge_id: charge.id })
              .eq('id', existingBySession.id)
            results.updatedPayments++
            continue
          }
        }

        // Check by member_id + amount + approximate date (within 24 hours to catch timezone/rounding issues)
        const chargeDate = new Date(charge.created * 1000)
        const minDate = new Date(chargeDate.getTime() - 24 * 60 * 60 * 1000).toISOString()
        const maxDate = new Date(chargeDate.getTime() + 24 * 60 * 60 * 1000).toISOString()

        const { data: existingByAmountDate } = await adminClient
          .from('payments')
          .select('id')
          .eq('member_id', memberId)
          .eq('amount_cents', charge.amount)
          .gte('created_at', minDate)
          .lte('created_at', maxDate)
          .maybeSingle()

        if (existingByAmountDate) {
          // Update with charge_id if missing
          await adminClient
            .from('payments')
            .update({ stripe_charge_id: charge.id })
            .eq('id', existingByAmountDate.id)
          results.updatedPayments++
          continue
        }

        // Last resort: check if there's ANY payment for this member with same amount and no charge_id
        // This catches old payments that were created before we started tracking charge_id
        const { data: existingWithoutChargeId } = await adminClient
          .from('payments')
          .select('id')
          .eq('member_id', memberId)
          .eq('amount_cents', charge.amount)
          .is('stripe_charge_id', null)
          .limit(1)
          .maybeSingle()

        if (existingWithoutChargeId) {
          // Update with charge_id
          await adminClient
            .from('payments')
            .update({ stripe_charge_id: charge.id })
            .eq('id', existingWithoutChargeId.id)
          results.updatedPayments++
          continue
        }

        // Insert new payment
        // Check for invoice OR subscription metadata to determine if recurring
        const isRecurring = !!charge.invoice || !!charge.metadata?.subscription_id
        const { error } = await adminClient.from('payments').insert({
          member_id: memberId,
          stripe_charge_id: charge.id,
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

    const roles = await getAdminRoles(adminClient, user.id)
    if (!roles.includes('super_admin')) {
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

        // If within 24 hours and same amount, it's likely a duplicate
        if (diffMs < 24 * 60 * 60 * 1000) {
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

// PATCH - Fix payment types by re-checking against Stripe
export async function PATCH(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const roles = await getAdminRoles(adminClient, user.id)
    if (!roles.some(r => ['super_admin', 'national_admin'].includes(r))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get all payments with their stripe_payment_intent_id
    const { data: payments } = await adminClient
      .from('payments')
      .select('id, stripe_payment_intent_id, payment_type')
      .eq('status', 'succeeded')

    let fixed = 0
    const errors = []

    for (const payment of payments || []) {
      if (!payment.stripe_payment_intent_id) continue

      try {
        // Get the payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id)

        // Get charges for this payment intent
        const charges = await stripe.charges.list({
          payment_intent: payment.stripe_payment_intent_id,
          limit: 1,
        })

        if (charges.data.length === 0) continue

        const charge = charges.data[0]
        const shouldBeRecurring = !!charge.invoice || !!charge.metadata?.subscription_id

        if (shouldBeRecurring && payment.payment_type === 'one_time') {
          // Update to recurring
          await adminClient
            .from('payments')
            .update({ payment_type: 'recurring' })
            .eq('id', payment.id)
          fixed++
        } else if (!shouldBeRecurring && payment.payment_type === 'recurring') {
          // Update to one_time
          await adminClient
            .from('payments')
            .update({ payment_type: 'one_time' })
            .eq('id', payment.id)
          fixed++
        }
      } catch (e) {
        errors.push({ payment_id: payment.id, error: e.message })
      }
    }

    return NextResponse.json({
      success: true,
      paymentsChecked: payments?.length || 0,
      fixed,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error('Fix payment types error:', error)
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

    const roles = await getAdminRoles(adminClient, user.id)
    if (roles.length === 0) {
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
