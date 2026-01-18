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

    // Email is required for guest checkout (Stripe needs it)
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

      // Redirect to Stripe Checkout
      window.location.href = data.url
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-900 to-blue-800 text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-700/50 rounded-full px-4 py-2 mb-6">
            <span className="text-blue-200 text-sm font-medium">Mutual Aid Initiative</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Care Packages for ICE Protestors
          </h1>
          <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto">
            Support the brave people standing up against ICE raids in our communities.
            Your donation provides water, food, first aid supplies, and other essentials
            to protestors on the front lines.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Left Column - Info */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                What Your Donation Provides
              </h2>

              <div className="space-y-4 mb-8">
                {CARE_PACKAGE_INFO.map((item) => (
                  <div key={item.amount} className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-800 font-bold">${item.amount}</span>
                    </div>
                    <div>
                      <p className="text-gray-700">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-4">Care Package Contents</h3>
                <ul className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Bottled water
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Energy bars & snacks
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    First aid supplies
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Sunscreen
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Hand sanitizer
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Phone charging banks
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Know-your-rights cards
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Emergency contacts
                  </li>
                </ul>
              </div>

              <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-800">
                  <strong>100% of donations</strong> go directly to purchasing supplies.
                  The Labor Party covers all administrative costs.
                </p>
              </div>
            </div>

            {/* Right Column - Donation Form */}
            <div>
              <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 md:p-8 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Make a Donation</h2>

                {error && (
                  <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex justify-between items-center">
                    <span>{error}</span>
                    <button type="button" onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
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
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
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
                      className={`w-full pl-7 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isCustom ? 'border-blue-600 ring-2 ring-blue-100' : 'border-gray-300'
                      }`}
                    />
                  </div>
                </div>

                {/* Donor Info */}
                <div className="border-t border-gray-200 pt-6 mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-4">Your Information</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Last Name</label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Last name"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Optional Sign-ups */}
                <div className="border-t border-gray-200 pt-6 mb-6 space-y-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={joinMailingList}
                      onChange={(e) => setJoinMailingList(e.target.checked)}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Join our mailing list</span>
                      <p className="text-xs text-gray-500">Get updates on this initiative and other Labor Party campaigns</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createAccount}
                      onChange={(e) => setCreateAccount(e.target.checked)}
                      className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">Create a Labor Party account</span>
                      <p className="text-xs text-gray-500">Track your contributions and get involved in the movement</p>
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
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Processing...' : `Donate $${getAmount().toFixed(2)}`}
                </button>

                <p className="text-xs text-gray-500 text-center mt-4">
                  Secure payment powered by Stripe. You'll be redirected to complete your donation.
                </p>
              </form>

              <p className="text-center text-sm text-gray-500 mt-6">
                Already a member?{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  Log in
                </Link>{' '}
                to have this donation tracked to your account.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="bg-gray-900 text-white py-12">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Want to do more?</h2>
          <p className="text-gray-300 mb-6">
            Join the Labor Party and help us organize for working people in your community.
          </p>
          <Link
            href="/join"
            className="inline-block bg-labor-red hover:bg-labor-red-dark text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            Become a Member
          </Link>
        </div>
      </section>
    </div>
  )
}
