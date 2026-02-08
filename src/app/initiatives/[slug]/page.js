'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

// FEC compliance attestation requirements
const FEC_ATTESTATIONS = [
  { id: 'us_citizen', label: 'I am a U.S. citizen or lawfully admitted permanent resident (green card holder).' },
  { id: 'personal_funds', label: 'This contribution is made from my own funds, not from the general treasury funds of a corporation, labor organization, or national bank.' },
  { id: 'own_behalf', label: 'This contribution is not made on behalf of any other person or entity, and I have not been reimbursed for this contribution.' },
  { id: 'not_contractor', label: 'I am not a federal contractor, and this contribution is not made in the name of a federal contractor.' },
]

export default function InitiativePage() {
  const params = useParams()
  const slug = params.slug

  const [initiative, setInitiative] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Donation form state
  const [selectedAmount, setSelectedAmount] = useState(25)
  const [customAmount, setCustomAmount] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Required donor info
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [joinMailingList, setJoinMailingList] = useState(false)
  const [createAccount, setCreateAccount] = useState(false)

  // FEC compliance fields
  const [employer, setEmployer] = useState('')
  const [occupation, setOccupation] = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [attestations, setAttestations] = useState({
    us_citizen: false,
    personal_funds: false,
    own_behalf: false,
    not_contractor: false,
  })

  useEffect(() => {
    const fetchInitiative = async () => {
      try {
        const res = await fetch(`/api/initiatives/${slug}`)
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        if (!res.ok) throw new Error('Failed to fetch initiative')
        const data = await res.json()
        setInitiative(data.initiative)
        // Set default amount from suggested amounts
        if (data.initiative?.suggested_amounts?.length > 0) {
          setSelectedAmount(data.initiative.suggested_amounts[0])
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      fetchInitiative()
    }
  }, [slug])

  const handleAttestationChange = (id) => {
    setAttestations(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const allAttestationsChecked = Object.values(attestations).every(v => v)

  const getAmount = () => {
    if (isCustom && customAmount) {
      return parseFloat(customAmount)
    }
    return selectedAmount
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const amount = getAmount()
    if (amount < (initiative?.min_amount || 1) || amount > 10000) {
      setError(`Amount must be between $${initiative?.min_amount || 1} and $10,000`)
      setSubmitting(false)
      return
    }

    if (!email) {
      setError('Email is required for donation receipt')
      setSubmitting(false)
      return
    }

    // FEC compliance validation
    if (!firstName.trim() || !lastName.trim()) {
      setError('Full name is required for FEC compliance.')
      setSubmitting(false)
      return
    }

    if (!streetAddress.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
      setError('Complete mailing address is required for FEC compliance.')
      setSubmitting(false)
      return
    }

    if (!employer.trim() || !occupation.trim()) {
      setError('Employer and occupation are required for FEC compliance.')
      setSubmitting(false)
      return
    }

    if (!allAttestationsChecked) {
      setError('Please confirm all FEC compliance attestations to proceed.')
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch(`/api/initiatives/${slug}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
          fec_attestations: attestations,
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
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-labor-red"></div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Initiative Not Found</h1>
          <p className="text-gray-500 mb-4">This initiative doesn't exist or is no longer active.</p>
          <Link href="/initiatives" className="btn-primary">
            View All Initiatives
          </Link>
        </div>
      </div>
    )
  }

  if (!initiative) {
    return null
  }

  const suggestedAmounts = initiative.suggested_amounts || [10, 25, 50, 100]

  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(226,85,85,0.06)_0%,_transparent_50%)]" />

        <div className="relative max-w-5xl mx-auto px-6 py-16">
          <Link
            href="/initiatives"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm mb-8 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Initiatives
          </Link>

          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-labor-red-50 text-labor-red-600 text-sm font-medium mb-8">
              <span className="w-2 h-2 rounded-full bg-labor-red animate-pulse" />
              {initiative.status === 'active' ? 'Active Campaign' : 'Completed'}
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
              {initiative.title}
            </h1>

            {initiative.description && (
              <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                {initiative.description}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Left Column - Description */}
            <div>
              {initiative.long_description && (
                <div className="prose prose-gray max-w-none mb-8">
                  <p className="whitespace-pre-wrap">{initiative.long_description}</p>
                </div>
              )}

              <div className="p-4 bg-labor-red-50 rounded-lg border border-labor-red-100">
                <p className="text-sm text-labor-red-700">
                  <strong>100% of donations</strong> go directly to the cause.
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
                    {suggestedAmounts.map((amount) => (
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
                {initiative.allow_custom_amount !== false && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Or enter a custom amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        min={initiative.min_amount || 1}
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
                    <p className="text-xs text-gray-500 mt-1">
                      Minimum ${initiative.min_amount || 1}
                    </p>
                  </div>
                )}

                {/* Donor Info - FEC Required */}
                <div className="border-t border-gray-100 pt-6 mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Your Information</h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Federal law requires political committees to collect this information.
                  </p>

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
                        <label className="block text-sm text-gray-600 mb-1">
                          First Name <span className="text-labor-red">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="First name"
                          className="input-field"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Last Name <span className="text-labor-red">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Last name"
                          className="input-field"
                        />
                      </div>
                    </div>

                    {/* Mailing Address */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Street Address <span className="text-labor-red">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={streetAddress}
                        onChange={(e) => setStreetAddress(e.target.value)}
                        placeholder="123 Main St"
                        className="input-field"
                      />
                    </div>

                    <div className="grid grid-cols-6 gap-4">
                      <div className="col-span-3">
                        <label className="block text-sm text-gray-600 mb-1">
                          City <span className="text-labor-red">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="City"
                          className="input-field"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="block text-sm text-gray-600 mb-1">
                          State <span className="text-labor-red">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={2}
                          value={state}
                          onChange={(e) => setState(e.target.value.toUpperCase())}
                          placeholder="CA"
                          className="input-field"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm text-gray-600 mb-1">
                          ZIP Code <span className="text-labor-red">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={zipCode}
                          onChange={(e) => setZipCode(e.target.value)}
                          placeholder="12345"
                          className="input-field"
                        />
                      </div>
                    </div>

                    {/* Employer/Occupation */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Employer <span className="text-labor-red">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={employer}
                          onChange={(e) => setEmployer(e.target.value)}
                          placeholder="Employer name"
                          className="input-field"
                        />
                        <p className="text-xs text-gray-500 mt-1">Or 'Self-employed', 'Retired', 'Not employed'</p>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          Occupation <span className="text-labor-red">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={occupation}
                          onChange={(e) => setOccupation(e.target.value)}
                          placeholder="Your occupation"
                          className="input-field"
                        />
                        <p className="text-xs text-gray-500 mt-1">Or 'Retired', 'Not employed'</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* FEC Attestations */}
                <div className="border-t border-gray-100 pt-6 mb-6">
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
                  disabled={submitting || !allAttestationsChecked || !firstName.trim() || !lastName.trim() || !streetAddress.trim() || !city.trim() || !state.trim() || !zipCode.trim() || !employer.trim() || !occupation.trim()}
                  className="btn-primary w-full py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Processing...' : `Donate $${getAmount().toFixed(2)}`}
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

      {/* Footer CTA */}
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
