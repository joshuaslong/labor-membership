'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const PRESET_AMOUNTS = [5, 10, 25, 50, 100, 250]

export default function DuesPage() {
  const router = useRouter()
  const [selectedAmount, setSelectedAmount] = useState(25)
  const [customAmount, setCustomAmount] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loadingSubscription, setLoadingSubscription] = useState(true)
  const [cancellingSubscription, setCancellingSubscription] = useState(false)

  useEffect(() => {
    const loadSubscription = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (member) {
          const { data: sub } = await supabase
            .from('member_subscriptions')
            .select('*')
            .eq('member_id', member.id)
            .eq('status', 'active')
            .single()

          setSubscription(sub)
        }
      }
      setLoadingSubscription(false)
    }

    loadSubscription()
  }, [])

  const getAmount = () => {
    if (isCustom && customAmount) {
      return parseFloat(customAmount)
    }
    return selectedAmount
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const amount = getAmount()
    if (amount < 1 || amount > 5000) {
      setError('Amount must be between $1 and $5,000')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, isRecurring }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    if (!subscription || !confirm('Are you sure you want to cancel your recurring dues?')) {
      return
    }

    setCancellingSubscription(true)
    try {
      const res = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subscription.stripe_subscription_id }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to cancel subscription')
      }

      setSubscription(null)
      router.refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setCancellingSubscription(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block">
        ← Back to Dashboard
      </Link>

      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Support the Party</h1>
      <p className="text-gray-600 mb-8">
        Your contribution helps us fight for working people. We don't take corporate money—we're powered by members like you.
      </p>

      {/* Current Subscription */}
      {!loadingSubscription && subscription && (
        <div className="card mb-6 border-l-4 border-labor-red">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-gray-900">Active Monthly Dues</h3>
              <p className="text-2xl font-bold text-labor-red">
                ${(subscription.amount_cents / 100).toFixed(2)}/month
              </p>
              <p className="text-sm text-gray-500">
                Next payment: {new Date(subscription.current_period_end).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={handleCancelSubscription}
              disabled={cancellingSubscription}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors"
            >
              {cancellingSubscription ? 'Cancelling...' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="card">
        {/* One-time vs Recurring Toggle */}
        <div className="flex gap-2 p-1 bg-gray-100 rounded-lg mb-6">
          <button
            type="button"
            onClick={() => setIsRecurring(false)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              !isRecurring
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            One-time
          </button>
          <button
            type="button"
            onClick={() => setIsRecurring(true)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              isRecurring
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
        </div>

        {/* Preset Amounts */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select an amount
          </label>
          <div className="grid grid-cols-3 gap-3">
            {PRESET_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => {
                  setSelectedAmount(amount)
                  setIsCustom(false)
                  setCustomAmount('')
                }}
                className={`py-3 px-4 rounded-lg border-2 text-center font-medium transition-colors ${
                  !isCustom && selectedAmount === amount
                    ? 'border-labor-red bg-labor-red-50 text-labor-red'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                ${amount}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Amount */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Or enter a custom amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              min="1"
              max="5000"
              step="1"
              placeholder="Custom amount"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value)
                setIsCustom(true)
              }}
              onFocus={() => setIsCustom(true)}
              className={`input-field pl-7 ${
                isCustom ? 'border-labor-red ring-2 ring-labor-red-100' : ''
              }`}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Minimum $1, maximum $5,000</p>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">
              {isRecurring ? 'Monthly dues' : 'One-time contribution'}
            </span>
            <span className="text-xl font-bold text-gray-900">
              ${getAmount().toFixed(2)}
              {isRecurring && <span className="text-sm font-normal text-gray-500">/mo</span>}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full btn-primary py-3 text-lg"
        >
          {loading ? 'Processing...' : `Contribute $${getAmount().toFixed(2)}${isRecurring ? '/month' : ''}`}
        </button>

        <p className="text-xs text-gray-500 text-center mt-4">
          Secure payment powered by Stripe. You'll be redirected to complete your payment.
        </p>
      </form>
    </div>
  )
}
