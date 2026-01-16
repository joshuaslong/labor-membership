import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

// Helper to sync Stripe data for a member
async function syncStripeData(member, adminSupabase) {
  let stripeCustomerId = member.stripe_customer_id

  // Try to find customer by email if no ID stored
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
      await adminSupabase.from('member_subscriptions').upsert({
        member_id: member.id,
        stripe_subscription_id: sub.id,
        stripe_price_id: sub.items.data[0]?.price?.id,
        amount_cents: sub.items.data[0]?.price?.unit_amount || 0,
        status: sub.status === 'canceled' ? 'cancelled' : sub.status,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        cancelled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      }, {
        onConflict: 'stripe_subscription_id',
      })
    }

    // Sync payments
    const charges = await stripe.charges.list({
      customer: stripeCustomerId,
      limit: 50,
    })

    for (const charge of charges.data) {
      if (charge.status !== 'succeeded') continue

      const { data: existing } = await adminSupabase
        .from('payments')
        .select('id')
        .eq('member_id', member.id)
        .eq('stripe_payment_intent_id', charge.payment_intent)
        .maybeSingle()

      if (!existing && charge.payment_intent) {
        await adminSupabase.from('payments').insert({
          member_id: member.id,
          stripe_payment_intent_id: charge.payment_intent,
          amount_cents: charge.amount,
          status: 'succeeded',
          payment_type: charge.invoice ? 'recurring' : 'one_time',
          created_at: new Date(charge.created * 1000).toISOString(),
        })
      }
    }
  } catch (e) {
    console.error('Error syncing Stripe data:', e)
  }
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: member } = await supabase
    .from('members')
    .select('*, chapters(name, level)')
    .eq('user_id', user.id)
    .single()

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const isAdmin = !!adminUser

  // Get payment data (use admin client since RLS might not allow cross-table access)
  let subscription = null
  let recentPayments = []
  let totalContributed = 0

  if (member) {
    const adminSupabase = createAdminClient()

    // Auto-sync from Stripe (this ensures data is always up to date)
    await syncStripeData(member, adminSupabase)

    // Get active subscription
    const { data: sub } = await adminSupabase
      .from('member_subscriptions')
      .select('*')
      .eq('member_id', member.id)
      .eq('status', 'active')
      .maybeSingle()
    subscription = sub

    // Get recent payments
    const { data: payments } = await adminSupabase
      .from('payments')
      .select('*')
      .eq('member_id', member.id)
      .eq('status', 'succeeded')
      .order('created_at', { ascending: false })
      .limit(3)
    recentPayments = payments || []

    // Calculate total contributed
    const { data: allPayments } = await adminSupabase
      .from('payments')
      .select('amount_cents')
      .eq('member_id', member.id)
      .eq('status', 'succeeded')
    totalContributed = allPayments?.reduce((sum, p) => sum + p.amount_cents, 0) / 100 || 0
  }

  if (!member) {
    if (isAdmin) {
      redirect('/admin')
    }
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="card text-center">
          <h1 className="text-2xl font-bold mb-4">Account Setup Required</h1>
          <p className="text-gray-600 mb-6">
            Your account is not linked to a membership. Please contact support.
          </p>
        </div>
      </div>
    )
  }

  const STATUS_COLORS = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    lapsed: 'bg-orange-100 text-orange-800',
    cancelled: 'bg-red-100 text-red-800',
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Welcome, {member.first_name}!
          </h1>
          <p className="text-gray-600">Member Dashboard</p>
        </div>
        {isAdmin && (
          <Link href="/admin" className="btn-primary w-full sm:w-auto text-center">
            Admin Dashboard
          </Link>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-4">Membership Status</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Status</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[member.status]}`}>
                {member.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Member Since</span>
              <span className="font-medium">
                {new Date(member.joined_date).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Chapter</span>
              <Link href={`/chapters/${member.chapter_id}`} className="text-labor-red hover:underline">
                {member.chapters?.name}
              </Link>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Your Profile</h2>
            <Link href="/dashboard/profile" className="text-labor-red text-sm hover:underline">
              Edit
            </Link>
          </div>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-500">Name:</span> {member.first_name} {member.last_name}</p>
            <p><span className="text-gray-500">Email:</span> {member.email}</p>
            {member.phone && <p><span className="text-gray-500">Phone:</span> {member.phone}</p>}
            {member.city && member.state && (
              <p><span className="text-gray-500">Location:</span> {member.city}, {member.state}</p>
            )}
          </div>
        </div>
      </div>

      {/* Support Section */}
      <div className="mt-6">
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold">Support the Party</h2>
              <p className="text-sm text-gray-500">Your contributions power our movement</p>
            </div>
            <Link href="/dashboard/dues" className="btn-primary w-full sm:w-auto text-center">
              {subscription ? 'Manage Dues' : 'Contribute'}
            </Link>
          </div>

          {subscription && (
            <div className="bg-labor-red-50 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-sm text-labor-red-600 font-medium">Active Monthly Dues</span>
                  <p className="text-2xl font-bold text-labor-red">
                    ${(subscription.amount_cents / 100).toFixed(2)}/month
                  </p>
                </div>
                <span className="text-xs text-gray-500">
                  Next: {new Date(subscription.current_period_end).toLocaleDateString()}
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center py-3 border-b border-gray-100">
            <span className="text-gray-600">Total Contributed</span>
            <span className="text-xl font-bold text-gray-900">${totalContributed.toFixed(2)}</span>
          </div>

          {recentPayments.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-gray-500">Recent Contributions</h3>
                <Link href="/dashboard/contributions" className="text-xs text-labor-red hover:underline">
                  View All
                </Link>
              </div>
              <div className="space-y-2">
                {recentPayments.map((payment) => (
                  <div key={payment.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {new Date(payment.created_at).toLocaleDateString()}
                      <span className="text-gray-400 ml-2">
                        {payment.payment_type === 'recurring' ? '(Monthly)' : '(One-time)'}
                      </span>
                    </span>
                    <span className="font-medium text-gray-900">
                      ${(payment.amount_cents / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!subscription && recentPayments.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">
              No contributions yet. Your support helps us fight for working people.
            </p>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100">
            <Link href="/dashboard/contributions" className="text-sm text-gray-500 hover:text-labor-red">
              View full contribution history →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
