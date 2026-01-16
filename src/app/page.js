import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Ticker Banner - Urgent, movement feel */}
      <div className="bg-gray-900 text-white py-2.5 px-4 border-b border-white/10">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-gray-400">We take $0 from corporations</span>
          </span>
          <span className="text-gray-600">•</span>
          <Link
            href="/contribute"
            className="font-medium text-white hover:text-labor-red transition-colors"
          >
            Chip in today →
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(226,85,85,0.06)_0%,_transparent_50%)]" />

        <div className="relative max-w-5xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-labor-red-50 text-labor-red-600 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-labor-red animate-pulse" />
            Zero corporate donors. We answer to you.
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight leading-tight">
            The game is rigged.
            <span className="block text-labor-red">We're changing the rules.</span>
          </h1>

          <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            You work hard. Your rent keeps rising. Your paycheck doesn't stretch like it used to.
            Both parties take corporate money and nothing changes. We don't. That's the difference.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/join" className="btn-primary text-lg px-8 py-3.5 w-full sm:w-auto">
              Join the Fight
            </Link>
            <Link href="/contribute" className="btn-secondary text-lg px-8 py-3.5 w-full sm:w-auto">
              Chip In
            </Link>
          </div>

          <p className="mt-4 text-sm text-gray-500">
            <Link href="/chapters" className="hover:text-labor-red underline">Find your local chapter</Link>
          </p>
        </div>
      </section>

      {/* Why We're Different Section */}
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">
              Why we can say what others won't
            </h2>
            <p className="mt-3 text-gray-500">
              No corporate money means no corporate leash
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card-hover text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-labor-red-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-labor-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">$0 from Corporations</h3>
              <p className="mt-2 text-gray-500 text-sm leading-relaxed">
                Pharma, Wall Street, Big Tech—they donate to both parties. That's why nothing changes. We refuse their money, so we can actually fight them.
              </p>
            </div>

            <div className="card-hover text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-labor-red-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-labor-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Funded by You</h3>
              <p className="mt-2 text-gray-500 text-sm leading-relaxed">
                Our power comes from regular people chipping in what they can. When politicians answer to donors, we answer to members. That's you.
              </p>
            </div>

            <div className="card-hover text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-labor-red-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-labor-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Built Where You Live</h3>
              <p className="mt-2 text-gray-500 text-sm leading-relaxed">
                Real change happens locally. Join your city or county chapter and connect with neighbors who are done waiting for the two parties to save them.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Donation CTA - The "Chip In" Block */}
      <section className="py-16 bg-gray-900 relative overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />

        <div className="relative max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-labor-red font-semibold text-sm tracking-wide uppercase mb-3">
              People-Powered
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
              They have billionaires.<br />
              <span className="text-gray-400">We have each other.</span>
            </h2>
          </div>

          {/* Amount Selection Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-2xl mx-auto">
            <Link
              href="/contribute?amount=10"
              className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-labor-red/50 rounded-xl p-4 md:p-5 text-center transition-all duration-200"
            >
              <div className="text-2xl md:text-3xl font-bold text-white group-hover:text-labor-red transition-colors">
                $10
              </div>
              <div className="text-xs text-gray-500 mt-1">prints flyers</div>
            </Link>

            <Link
              href="/contribute?amount=25"
              className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-labor-red/50 rounded-xl p-4 md:p-5 text-center transition-all duration-200"
            >
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-labor-red text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                Popular
              </div>
              <div className="text-2xl md:text-3xl font-bold text-white group-hover:text-labor-red transition-colors">
                $25
              </div>
              <div className="text-xs text-gray-500 mt-1">most common</div>
            </Link>

            <Link
              href="/contribute?amount=50"
              className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-labor-red/50 rounded-xl p-4 md:p-5 text-center transition-all duration-200"
            >
              <div className="text-2xl md:text-3xl font-bold text-white group-hover:text-labor-red transition-colors">
                $50
              </div>
              <div className="text-xs text-gray-500 mt-1">trains organizer</div>
            </Link>

            <Link
              href="/contribute?amount=100"
              className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-labor-red/50 rounded-xl p-4 md:p-5 text-center transition-all duration-200"
            >
              <div className="text-2xl md:text-3xl font-bold text-white group-hover:text-labor-red transition-colors">
                $100
              </div>
              <div className="text-xs text-gray-500 mt-1">local campaign</div>
            </Link>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/contribute"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              Choose your own amount
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>

          {/* Social Proof */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Secure payment via Stripe
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <svg className="w-4 h-4 text-labor-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                $0 corporate money
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Takes 30 seconds
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Monthly Giving Pitch */}
      <section className="py-16 bg-labor-red-50 border-y border-labor-red-100">
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-labor-red/10 rounded-full text-labor-red text-xs font-semibold mb-4">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sustaining Member
              </div>
              <h3 className="text-2xl font-bold text-gray-900 tracking-tight">
                $10/month changes everything
              </h3>
              <p className="mt-3 text-gray-600">
                Reliable funding lets us plan ahead, hire organizers, and build real power.
                500 people giving $10/month funds a full-time organizer for a year.
              </p>
              <Link
                href="/contribute?recurring=true"
                className="inline-flex items-center gap-2 mt-5 text-labor-red font-semibold hover:gap-3 transition-all"
              >
                Become a sustaining member
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
            <div className="flex-shrink-0">
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm max-w-[200px]">
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-labor-red-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-labor-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-gray-600">Cancel anytime</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-labor-red-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-labor-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-gray-600">Change amount</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-labor-red-50 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-labor-red" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span className="text-gray-600">100% to the cause</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
            Stop waiting. Start fighting.
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Politicians won't save you. Organized people will.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/join"
              className="btn-primary text-lg px-8 py-3.5 w-full sm:w-auto"
            >
              Join the Labor Party
            </Link>
            <Link
              href="/contribute"
              className="btn-secondary text-lg px-8 py-3.5 w-full sm:w-auto"
            >
              Contribute
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
