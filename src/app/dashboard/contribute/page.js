'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const PRESET_AMOUNTS = [5, 10, 25, 50, 100, 250]

// FEC compliance attestation requirements
const FEC_ATTESTATIONS = [
  { id: 'us_citizen', label: 'I am a U.S. citizen or lawfully admitted permanent resident (green card holder).' },
  { id: 'personal_funds', label: 'This contribution is made from my own funds, not from the general treasury funds of a corporation, labor organization, or national bank.' },
  { id: 'own_behalf', label: 'This contribution is not made on behalf of any other person or entity, and I have not been reimbursed for this contribution.' },
  { id: 'not_contractor', label: 'I am not a federal contractor, and this contribution is not made in the name of a federal contractor.' },
]

// Helper to safely format dates - returns null if invalid
function formatDate(dateString, options = {}) {
  if (!dateString) return null
  const date = new Date(dateString)
  // Check for invalid date or Unix epoch (1970)
  if (isNaN(date.getTime()) || date.getFullYear() < 2000) return null
  return date.toLocaleDateString('en-US', options)
}

// Wrapper component to handle Suspense for useSearchParams
export default function ContributePage() {
  return (
    <Suspense fallback={
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-8"></div>
          <div className="card">
            <div className="h-32 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    }>
      <ContributePageContent />
    </Suspense>
  )
}

function ContributePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get amount and recurring from URL if provided
  const urlAmount = searchParams.get('amount')
  const urlRecurring = searchParams.get('recurring')
  const initialAmount = urlAmount ? parseInt(urlAmount, 10) : 25
  const isInitialCustom = urlAmount && !PRESET_AMOUNTS.includes(initialAmount)

  const [selectedAmount, setSelectedAmount] = useState(isInitialCustom ? 25 : initialAmount)
  const [customAmount, setCustomAmount] = useState(isInitialCustom ? urlAmount : '')
  const [isCustom, setIsCustom] = useState(isInitialCustom)
  const [isRecurring, setIsRecurring] = useState(urlRecurring === 'true')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [loadingSubscription, setLoadingSubscription] = useState(true)
  const [cancellingSubscription, setCancellingSubscription] = useState(false)
  const [restoringSubscription, setRestoringSubscription] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updatingSubscription, setUpdatingSubscription] = useState(false)
  const [newAmount, setNewAmount] = useState('')

  // FEC compliance fields
  const [employer, setEmployer] = useState('')
  const [occupation, setOccupation] = useState('')
  const [attestations, setAttestations] = useState({
    us_citizen: false,
    personal_funds: false,
    own_behalf: false,
    not_contractor: false,
  })

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
          // Get active subscription (we detect cancelling via cancelled_at field)
          const { data: sub } = await supabase
            .from('member_subscriptions')
            .select('*')
            .eq('member_id', member.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          // Add isCancelling flag if cancelled_at is set
          if (sub) {
            sub.isCancelling = !!sub.cancelled_at
          }
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

  const handleAttestationChange = (id) => {
    setAttestations(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const allAttestationsChecked = Object.values(attestations).every(v => v)

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

    // FEC compliance validation
    if (!allAttestationsChecked) {
      setError('Please confirm all FEC compliance attestations to proceed.')
      setLoading(false)
      return
    }

    if (!employer.trim() || !occupation.trim()) {
      setError('Employer and occupation are required for FEC compliance.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          isRecurring,
          employer: employer.trim(),
          occupation: occupation.trim(),
          fec_attestations: attestations,
        }),
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
    if (!subscription) return

    setCancellingSubscription(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subscription.stripe_subscription_id }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to cancel subscription')
      }

      setSubscription({
        ...subscription,
        status: 'active', // Keep status as active in local state (matches DB)
        cancelled_at: new Date().toISOString(),
        isCancelling: true,
      })
      setSuccess('Your subscription has been cancelled. You\'ll still have access until the end of your billing period.')
    } catch (err) {
      setError(err.message)
    } finally {
      setCancellingSubscription(false)
    }
  }

  const handleRestoreSubscription = async () => {
    if (!subscription) return

    setRestoringSubscription(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/restore-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subscription.stripe_subscription_id }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to restore subscription')
      }

      setSubscription({
        ...subscription,
        status: 'active',
        cancelled_at: null,
        isCancelling: false,
      })
      setSuccess('Your subscription has been restored!')
    } catch (err) {
      setError(err.message)
    } finally {
      setRestoringSubscription(false)
    }
  }

  const handleUpdateSubscription = async () => {
    if (!subscription || !newAmount) return

    const amount = parseFloat(newAmount)
    if (amount < 1 || amount > 5000) {
      setError('Amount must be between $1 and $5,000')
      return
    }

    setUpdatingSubscription(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/update-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: subscription.stripe_subscription_id,
          newAmount: amount,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update subscription')
      }

      setSubscription({
        ...subscription,
        amount_cents: Math.round(amount * 100),
        status: 'active',
        cancelled_at: null,
        isCancelling: false,
      })
      setShowUpdateModal(false)
      setNewAmount('')
      setSuccess('Your subscription has been updated!')
    } catch (err) {
      setError(err.message)
    } finally {
      setUpdatingSubscription(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <Link href="/dashboard" className="text-gray-500 hover:text-gray-900 text-sm mb-4 inline-block">
        ← Back to Dashboard
      </Link>

      <h1 className="text-2xl sm:text-3xl text-gray-900 mb-2">Support the Party</h1>
      <p className="text-gray-600 mb-8">
        Your contribution helps us fight for working people. We don't take corporate money—we're powered by members like you.
      </p>

      {/* Current Subscription */}
      {!loadingSubscription && subscription && (
        <div className={`card mb-6 border-l-4 ${subscription.isCancelling ? 'border-orange-500' : 'border-labor-red'}`}>
          {subscription.isCancelling ? (
            // Cancelling state - show end date and restore option
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full">
                  Cancelling
                </span>
              </div>
              <div className="mb-4">
                <p className="text-gray-600 text-sm">Your monthly contribution of</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${(subscription.amount_cents / 100).toFixed(2)}/month
                </p>
                {formatDate(subscription.current_period_end, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) && (
                  <p className="text-sm text-orange-600 font-medium mt-2">
                    Ends on {formatDate(subscription.current_period_end, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  You won't be charged again after this date.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleRestoreSubscription}
                  disabled={restoringSubscription}
                  className="btn-primary flex-1"
                >
                  {restoringSubscription ? 'Restoring...' : 'Keep My Subscription'}
                </button>
                <button
                  onClick={() => {
                    setNewAmount((subscription.amount_cents / 100).toString())
                    setShowUpdateModal(true)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  Change Amount
                </button>
              </div>
            </>
          ) : (
            // Active state
            <>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                  Active
                </span>
              </div>
              <div className="mb-4">
                <p className="text-gray-600 text-sm">Monthly contribution</p>
                <p className="text-2xl font-bold text-labor-red">
                  ${(subscription.amount_cents / 100).toFixed(2)}/month
                </p>
                {formatDate(subscription.current_period_end) && (
                  <p className="text-sm text-gray-500 mt-1">
                    Next payment: {formatDate(subscription.current_period_end)}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    setNewAmount((subscription.amount_cents / 100).toString())
                    setShowUpdateModal(true)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium flex-1"
                >
                  Change Amount
                </button>
                <button
                  onClick={handleCancelSubscription}
                  disabled={cancellingSubscription}
                  className="px-4 py-2 border border-red-200 rounded-lg text-red-600 hover:bg-red-50 text-sm font-medium"
                >
                  {cancellingSubscription ? 'Cancelling...' : 'Cancel Subscription'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Update Amount Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg text-gray-900 mb-4">Update Monthly Amount</h3>
            <p className="text-sm text-gray-600 mb-4">
              Change your monthly contribution. The new amount will be prorated for the current billing period.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">New monthly amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  step="1"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="input-field pl-7"
                  placeholder="Enter amount"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Minimum $1, maximum $5,000</p>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-6">
              {[10, 25, 50].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setNewAmount(amt.toString())}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    newAmount === amt.toString()
                      ? 'border-labor-red bg-labor-red-50 text-labor-red'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowUpdateModal(false)
                  setNewAmount('')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateSubscription}
                disabled={updatingSubscription || !newAmount}
                className="flex-1 btn-primary"
              >
                {updatingSubscription ? 'Updating...' : 'Update Amount'}
              </button>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6 flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
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

        {/* FEC Compliance - Employer/Occupation */}
        <div className="border-t border-gray-200 pt-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">FEC Compliance Information</h3>
          <p className="text-xs text-gray-500 mb-4">
            Federal law requires political committees to collect and report this information.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employer <span className="text-labor-red">*</span>
              </label>
              <input
                type="text"
                value={employer}
                onChange={(e) => setEmployer(e.target.value)}
                placeholder="Enter your employer (or 'Self-employed', 'Retired', 'Not employed')"
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Occupation <span className="text-labor-red">*</span>
              </label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="Enter your occupation (or 'Retired', 'Not employed')"
                className="input-field"
                required
              />
            </div>
          </div>
        </div>

        {/* FEC Attestations */}
        <div className="border-t border-gray-200 pt-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Required Certifications</h3>
          <div className="space-y-3">
            {FEC_ATTESTATIONS.map((attestation) => (
              <label key={attestation.id} className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attestations[attestation.id]}
                  onChange={() => handleAttestationChange(attestation.id)}
                  className="mt-0.5 w-4 h-4 text-labor-red border-gray-300 rounded focus:ring-labor-red"
                />
                <span className="text-sm text-gray-600">{attestation.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">
              {isRecurring ? 'Monthly contribution' : 'One-time contribution'}
            </span>
            <span className="text-xl font-bold text-gray-900">
              ${getAmount().toFixed(2)}
              {isRecurring && <span className="text-sm font-normal text-gray-500">/mo</span>}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !allAttestationsChecked || !employer.trim() || !occupation.trim()}
          className="w-full btn-primary py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
