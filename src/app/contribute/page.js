import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const PRESET_AMOUNTS = [5, 10, 25, 50, 100, 250]

export default async function ContributePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If logged in, redirect to the member dues page
  if (user) {
    redirect('/dashboard/dues')
  }

  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Hero */}
      <section className="bg-gradient-to-b from-labor-red-50 to-white py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
            Fund the fight for working people
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            We refuse corporate money. That means we answer to you—not billionaires,
            not lobbyists, not special interests. Your contribution powers a movement
            that actually fights for working families.
          </p>
        </div>
      </section>

      {/* Contribution Options */}
      <section className="py-12">
        <div className="max-w-xl mx-auto px-6">
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Choose an amount</h2>
            <p className="text-sm text-gray-500 mb-6">
              Every dollar helps us organize, educate, and fight back.
            </p>

            {/* Amount Grid */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {PRESET_AMOUNTS.map((amount) => (
                <div
                  key={amount}
                  className="py-4 px-4 rounded-lg border-2 border-gray-200 text-center font-semibold text-gray-700"
                >
                  ${amount}
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="bg-labor-red-50 rounded-lg p-6 text-center">
              <p className="text-gray-700 mb-4">
                <strong>Ready to contribute?</strong> Create a free account to contribute
                and track your support for the movement.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link href="/join" className="btn-primary py-3 px-6">
                  Join & Contribute
                </Link>
                <Link href="/login" className="btn-secondary py-3 px-6">
                  Log In to Contribute
                </Link>
              </div>
            </div>
          </div>

          {/* Why Contribute */}
          <div className="mt-8 space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-labor-red-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-labor-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">100% Member-Funded</h3>
                <p className="text-sm text-gray-600">
                  We take $0 from corporations. Your contribution goes directly to organizing
                  working people, not paying back special interests.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-labor-red-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-labor-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Secure & Transparent</h3>
                <p className="text-sm text-gray-600">
                  Payments processed securely by Stripe. We publish our finances
                  so you always know where your money goes.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-labor-red-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-labor-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Monthly or One-Time</h3>
                <p className="text-sm text-gray-600">
                  Set up recurring dues to provide steady support, or make a
                  one-time contribution. Every bit helps.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
