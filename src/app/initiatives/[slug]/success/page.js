import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function InitiativeSuccessPage({ params, searchParams }) {
  const { slug } = await params
  const { session_id: sessionId } = await searchParams

  if (!sessionId) {
    redirect(`/initiatives/${slug}`)
  }

  const supabase = createAdminClient()

  // Get initiative details
  const { data: initiative } = await supabase
    .from('initiatives')
    .select('id, slug, title, description')
    .eq('slug', slug)
    .single()

  if (!initiative) {
    notFound()
  }

  let session = null
  let paymentIntent = null
  let donorInfo = null
  let addedToMailingList = false

  try {
    // Get the checkout session from Stripe
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    })

    paymentIntent = session.payment_intent

    // Extract metadata
    const metadata = session.metadata || {}
    donorInfo = {
      email: metadata.email,
      firstName: metadata.first_name,
      lastName: metadata.last_name,
    }

    // Handle mailing list signup
    if (metadata.join_mailing_list === 'true' && metadata.email) {
      // Check if already on mailing list
      const { data: existing } = await supabase
        .from('mailing_list')
        .select('id')
        .eq('email', metadata.email.toLowerCase())
        .maybeSingle()

      if (!existing) {
        await supabase.from('mailing_list').insert({
          email: metadata.email.toLowerCase(),
          first_name: metadata.first_name || null,
          last_name: metadata.last_name || null,
          source: `initiative-${slug}`,
        })
        addedToMailingList = true
      }
    }

    // Record the payment if we have a member_id
    if (metadata.member_id && session.payment_status === 'paid') {
      const chargeId = paymentIntent?.latest_charge

      // Check if payment already exists
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .maybeSingle()

      if (!existingPayment) {
        await supabase.from('payments').insert({
          member_id: metadata.member_id,
          stripe_charge_id: chargeId || null,
          stripe_payment_intent_id: paymentIntent.id,
          stripe_checkout_session_id: session.id,
          amount_cents: session.amount_total,
          status: 'succeeded',
          payment_type: 'initiative',
          employer: metadata.employer || null,
          occupation: metadata.occupation || null,
          street_address: metadata.street_address || null,
          city: metadata.city || null,
          state: metadata.state || null,
          zip_code: metadata.zip_code || null,
          fec_attested_at: metadata.fec_attested_at || null,
        })
      }
    }

  } catch (error) {
    console.error('Error processing success page:', error)
  }

  const amount = session?.amount_total ? (session.amount_total / 100).toFixed(2) : '0.00'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success Header */}
      <section className="bg-gradient-to-b from-green-600 to-green-700 text-white py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Thank You for Your Donation!
          </h1>
          <p className="text-lg text-green-100">
            Your contribution to {initiative.title} makes a real difference.
          </p>
        </div>
      </section>

      {/* Donation Details */}
      <section className="py-12">
        <div className="max-w-xl mx-auto px-6">
          <div className="bg-white rounded-xl shadow-lg p-6 md:p-8 border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Donation Summary</h2>

            <div className="border-b border-gray-200 pb-4 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Amount donated</span>
                <span className="text-2xl font-bold text-green-600">${amount}</span>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Initiative</span>
                <span className="text-gray-900">{initiative.title}</span>
              </div>
              {donorInfo?.email && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Receipt sent to</span>
                  <span className="text-gray-900">{donorInfo.email}</span>
                </div>
              )}
              {addedToMailingList && (
                <div className="flex items-center gap-2 text-green-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Added to mailing list</span>
                </div>
              )}
            </div>

            {/* Account creation CTA if they requested it */}
            {session?.metadata?.create_account === 'true' && !session?.metadata?.member_id && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h3 className="font-semibold text-blue-900 mb-2">Create Your Account</h3>
                <p className="text-sm text-blue-700 mb-3">
                  Complete your Labor Party membership to track contributions and get involved.
                </p>
                <Link
                  href={`/join?email=${encodeURIComponent(donorInfo?.email || '')}`}
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
                >
                  Complete Registration
                </Link>
              </div>
            )}
          </div>

          {/* What Happens Next */}
          <div className="mt-8 bg-white rounded-xl p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">What Happens Next</h3>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-labor-red-50 text-labor-red rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <span>Your donation is processed securely via Stripe</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-labor-red-50 text-labor-red rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <span>100% of your donation goes directly to the cause</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-labor-red-50 text-labor-red rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <span>You'll receive a receipt via email for your records</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-labor-red-50 text-labor-red rounded-full flex items-center justify-center text-xs font-bold">4</span>
                <span>Follow us for updates on this initiative's progress</span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4">
            <Link
              href={`/initiatives/${slug}`}
              className="flex-1 text-center bg-white border border-gray-300 text-gray-700 font-medium py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Donate Again
            </Link>
            <Link
              href="/initiatives"
              className="flex-1 text-center bg-gray-900 text-white font-medium py-3 px-6 rounded-lg hover:bg-gray-800 transition-colors"
            >
              View All Initiatives
            </Link>
          </div>

          {/* Share */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 mb-3">Help spread the word</p>
            <div className="flex justify-center gap-4">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just donated to support ${initiative.title}. Join me in making a difference!`)}&url=${encodeURIComponent(`https://members.votelabor.org/initiatives/${slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-500 transition-colors"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://members.votelabor.org/initiatives/${slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-blue-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
