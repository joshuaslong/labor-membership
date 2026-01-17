import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

// Helper to sync Stripe data for a member
async function syncStripeData(member, adminSupabase) {
  let stripeCustomerId = member.stripe_customer_id

  if (!stripeCustomerId) {
    try {
      const customers = await stripe.customers.list({
        email: member.email,
        limit: 1,
      })
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id
        await adminSupabase
          .from('members')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('id', member.id)
      }
    } catch (e) {
      console.error('Error finding Stripe customer:', e)
    }
  }

  if (!stripeCustomerId) return

  try {
    // Sync subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      limit: 10,
    })

    for (const sub of subscriptions.data) {
      // Safely convert timestamps
      const periodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000).toISOString() : null
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null
      const cancelledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null

      // Determine our status based on Stripe's status and cancel_at_period_end
      let ourStatus = sub.status
      if (sub.status === 'canceled') {
        ourStatus = 'cancelled'
      } else if (sub.status === 'active' && sub.cancel_at_period_end) {
        ourStatus = 'cancelling'
      }

      await adminSupabase.from('member_subscriptions').upsert({
        member_id: member.id,
        stripe_subscription_id: sub.id,
        stripe_price_id: sub.items.data[0]?.price?.id,
        amount_cents: sub.items.data[0]?.price?.unit_amount || 0,
        status: ourStatus,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancelled_at: cancelledAt,
      }, {
        onConflict: 'stripe_subscription_id',
      })
    }

    // Sync payments
    const charges = await stripe.charges.list({
      customer: stripeCustomerId,
      limit: 100,
    })

    for (const charge of charges.data) {
      if (charge.status !== 'succeeded') continue

      // Check if payment already exists by charge ID (most reliable)
      const { data: existingByCharge } = await adminSupabase
        .from('payments')
        .select('id')
        .eq('stripe_charge_id', charge.id)
        .maybeSingle()

      if (existingByCharge) continue

      // Also check by payment_intent if available
      if (charge.payment_intent) {
        const { data: existing } = await adminSupabase
          .from('payments')
          .select('id')
          .eq('stripe_payment_intent_id', charge.payment_intent)
          .maybeSingle()

        if (existing) {
          // Update with charge_id if missing
          await adminSupabase
            .from('payments')
            .update({ stripe_charge_id: charge.id })
            .eq('id', existing.id)
          continue
        }
      }

      // Also check by member_id + amount + approximate date (within 1 hour to catch timezone/rounding issues)
      const chargeDate = new Date(charge.created * 1000)
      const minDate = new Date(chargeDate.getTime() - 3600000).toISOString()
      const maxDate = new Date(chargeDate.getTime() + 3600000).toISOString()

      const { data: existingByAmountDate } = await adminSupabase
        .from('payments')
        .select('id')
        .eq('member_id', member.id)
        .eq('amount_cents', charge.amount)
        .gte('created_at', minDate)
        .lte('created_at', maxDate)
        .maybeSingle()

      if (existingByAmountDate) {
        // Update with charge_id if missing
        await adminSupabase
          .from('payments')
          .update({ stripe_charge_id: charge.id })
          .eq('id', existingByAmountDate.id)
        continue
      }

      // Insert new payment
      // Determine if this is a recurring payment - check for invoice OR subscription
      const isRecurring = !!charge.invoice || !!charge.metadata?.subscription_id

      await adminSupabase.from('payments').insert({
        member_id: member.id,
        stripe_charge_id: charge.id,
        stripe_payment_intent_id: charge.payment_intent,
        amount_cents: charge.amount,
        status: 'succeeded',
        payment_type: isRecurring ? 'recurring' : 'one_time',
        created_at: new Date(charge.created * 1000).toISOString(),
      })
    }
  } catch (e) {
    console.error('Error syncing Stripe data:', e)
  }
}

export const dynamic = 'force-dynamic'

export default async function ContributionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: member } = await supabase
    .from('members')
    .select('id, first_name, email, stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  if (!member) {
    redirect('/dashboard')
  }

  const adminSupabase = createAdminClient()

  // Auto-sync from Stripe
  await syncStripeData(member, adminSupabase)

  // Get all payments
  const { data: payments } = await adminSupabase
    .from('payments')
    .select('*')
    .eq('member_id', member.id)
    .order('created_at', { ascending: false })

  // Get all subscriptions (including cancelled)
  const { data: subscriptions } = await adminSupabase
    .from('member_subscriptions')
    .select('*')
    .eq('member_id', member.id)
    .order('created_at', { ascending: false })

  // Calculate totals
  const successfulPayments = payments?.filter(p => p.status === 'succeeded') || []
  const totalContributed = successfulPayments.reduce((sum, p) => sum + p.amount_cents, 0) / 100
  const oneTimeTotal = successfulPayments.filter(p => p.payment_type === 'one_time').reduce((sum, p) => sum + p.amount_cents, 0) / 100
  const recurringTotal = successfulPayments.filter(p => p.payment_type === 'recurring').reduce((sum, p) => sum + p.amount_cents, 0) / 100

  const activeSubscription = subscriptions?.find(s => s.status === 'active')

  const STATUS_COLORS = {
    succeeded: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
    refunded: 'bg-gray-100 text-gray-800',
  }

  const SUB_STATUS_COLORS = {
    active: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800',
    past_due: 'bg-orange-100 text-orange-800',
    incomplete: 'bg-yellow-100 text-yellow-800',
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm mb-4 inline-block">
        ← Back to Dashboard
      </Link>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Contribution History</h1>
          <p className="text-gray-600">Your complete payment and subscription history</p>
        </div>
        <Link href="/dashboard/contribute" className="btn-primary w-full sm:w-auto text-center">
          Make a Contribution
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="card text-center">
          <p className="text-sm text-gray-500 mb-1">Total Contributed</p>
          <p className="text-3xl font-bold text-labor-red">${totalContributed.toFixed(2)}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500 mb-1">One-time Contributions</p>
          <p className="text-2xl font-bold text-gray-900">${oneTimeTotal.toFixed(2)}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500 mb-1">Monthly Contributions</p>
          <p className="text-2xl font-bold text-gray-900">${recurringTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* Active Subscription */}
      {activeSubscription && (
        <div className="card mb-8 border-l-4 border-labor-red">
          <h2 className="text-lg font-bold mb-4">Active Subscription</h2>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <p className="text-2xl font-bold text-labor-red">
                ${(activeSubscription.amount_cents / 100).toFixed(2)}/month
              </p>
              <p className="text-sm text-gray-500">
                Next payment: {new Date(activeSubscription.current_period_end).toLocaleDateString()}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Started: {new Date(activeSubscription.created_at).toLocaleDateString()}
              </p>
            </div>
            <Link href="/dashboard/contribute" className="text-sm text-gray-500 hover:text-red-600">
              Manage Subscription
            </Link>
          </div>
        </div>
      )}

      {/* Subscriptions History */}
      {subscriptions && subscriptions.length > 0 && (
        <div className="card mb-8">
          <h2 className="text-lg font-bold mb-4">Subscription History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Amount</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Started</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Period End</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((sub) => (
                  <tr key={sub.id} className="border-b border-gray-100">
                    <td className="py-3 px-2 font-medium">
                      ${(sub.amount_cents / 100).toFixed(2)}/mo
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${SUB_STATUS_COLORS[sub.status] || 'bg-gray-100'}`}>
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-gray-600">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2 text-gray-600">
                      {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment History */}
      <div className="card">
        <h2 className="text-lg font-bold mb-4">Payment History</h2>

        {payments && payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Date</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Amount</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Type</th>
                  <th className="text-left py-3 px-2 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-100">
                    <td className="py-3 px-2 text-gray-600">
                      {new Date(payment.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2 font-medium">
                      ${(payment.amount_cents / 100).toFixed(2)}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        payment.payment_type === 'recurring'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {payment.payment_type === 'recurring' ? 'Monthly' : 'One-time'}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[payment.status]}`}>
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No payment history yet.</p>
            <Link href="/dashboard/contribute" className="btn-primary">
              Make Your First Contribution
            </Link>
          </div>
        )}
      </div>

    </div>
  )
}
