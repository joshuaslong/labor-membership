'use client'

import { useState } from 'react'
import Link from 'next/link'

const PRESET_AMOUNTS = [10, 25, 50, 100, 250, 500]

const CARE_PACKAGE_INFO = [
  { amount: 25, description: 'Provides water, snacks, and basic supplies for 5 protestors' },
  { amount: 50, description: 'Supplies a full day of hydration and nutrition for 10 protestors' },
  { amount: 100, description: 'Funds a complete care station setup for a protest site' },
  { amount: 250, description: 'Sponsors care packages for an entire weekend of protests' },
]

export default function CarePackagesPage() {
  const [selectedAmount, setSelectedAmount] = useState(25)
  const [customAmount, setCustomAmount] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Optional fields
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [joinMailingList, setJoinMailingList] = useState(false)
  const [createAccount, setCreateAccount] = useState(false)

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
    if (amount < 1 || amount > 10000) {
      setError('Amount must be between $1 and $10,000')
      setLoading(false)
      return
    }

    if (!email) {
      setError('Email is required for donation receipt')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/initiatives/care-packages/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          email,
          firstName,
          lastName,
          joinMailingList,
          createAccount,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      window.location.href = data.url
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Hero Section - Matching landing page style */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(226,85,85,0.06)_0%,_transparent_50%)]" />

        <div className="relative max-w-5xl mx-auto px-6 py-16 text-center">
          <Link
            href="/initiatives"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Initiatives
          </Link>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-labor-red-50 text-labor-red-600 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-labor-red animate-pulse" />
            Active Campaign
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
            Care Packages for
            <span className="block text-labor-red">ICE Protestors</span>
          </h1>

          <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Support the brave people standing up against ICE raids in our communities.
            Your donation provides water, food, first aid supplies, and other essentials.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Left Column - Info */}
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 tracking-tight mb-6">
                What Your Donation Provides
              </h2>

              <div className="space-y-4 mb-8">
                {CARE_PACKAGE_INFO.map((item) => (
                  <div key={item.amount} className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-14 h-14 rounded-lg bg-labor-red-50 flex items-center justify-center">
                      <span className="text-labor-red font-bold">${item.amount}</span>
                    </div>
                    <div className="pt-2">
                      <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Care Package Contents</h3>
                <ul className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                  {[
                    'Bottled water',
                    'Energy bars & snacks',
                    'First aid supplies',
                    'Sunscreen',
                    'Hand sanitizer',
                    'Phone charging banks',
                    'Know-your-rights cards',
                    'Emergency contacts',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-labor-red flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 p-4 bg-labor-red-50 rounded-lg border border-labor-red-100">
                <p className="text-sm text-labor-red-700">
                  <strong>100% of donations</strong> go directly to purchasing supplies.
                  The Labor Party covers all administrative costs.
                </p>
              </div>
            </div>

            {/* Right Column - Donation Form */}
            <div>
              <form onSubmit={handleSubmit} className="card">
                <h2 className="text-xl font-semibold text-gray-900 tracking-tight mb-6">Make a Donation</h2>

                {error && (
                  <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex justify-between items-center text-sm">
                    <span>{error}</span>
                    <button type="button" onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Amount Selection */}
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
                      max="10000"
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
                </div>

                {/* Donor Info */}
                <div className="border-t border-gray-100 pt-6 mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-4">Your Information</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Email <span className="text-labor-red">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="input-field"
                      />
                      <p className="text-xs text-gray-500 mt-1">Required for your donation receipt</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">First Name</label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="First name"
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Last Name</label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Last name"
                          className="input-field"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Optional Sign-ups */}
                <div className="border-t border-gray-100 pt-6 mb-6 space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={joinMailingList}
                      onChange={(e) => setJoinMailingList(e.target.checked)}
                      className="mt-1 w-4 h-4 text-labor-red border-gray-300 rounded focus:ring-labor-red"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Join our mailing list</span>
                      <p className="text-xs text-gray-500">Get updates on this initiative and other campaigns</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createAccount}
                      onChange={(e) => setCreateAccount(e.target.checked)}
                      className="mt-1 w-4 h-4 text-labor-red border-gray-300 rounded focus:ring-labor-red"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Create a Labor Party account</span>
                      <p className="text-xs text-gray-500">Track your contributions and get involved</p>
                    </div>
                  </label>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Donation amount</span>
                    <span className="text-2xl font-bold text-gray-900">
                      ${getAmount().toFixed(2)}
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full py-4 text-lg"
                >
                  {loading ? 'Processing...' : `Donate $${getAmount().toFixed(2)}`}
                </button>

                <p className="text-xs text-gray-500 text-center mt-4">
                  Secure payment powered by Stripe. You'll be redirected to complete your donation.
                </p>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Already a member?{' '}
                <Link href="/login" className="text-labor-red hover:text-labor-red-dark font-medium">
                  Log in
                </Link>{' '}
                to have this donation tracked to your account.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA - Matching landing page dark section */}
      <section className="py-16 bg-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <p className="text-labor-red font-semibold text-sm tracking-wide uppercase mb-3">
            Join the Movement
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            <span className="text-gray-400">Want to do more?</span><br />
            <span className="text-white">Become a member.</span>
          </h2>
          <p className="mt-4 text-gray-400 max-w-xl mx-auto">
            Join the Labor Party and help us organize for working people in your community.
          </p>

          <div className="mt-10">
            <Link
              href="/join"
              className="btn-primary text-lg px-8 py-3.5"
            >
              Become a Member
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
