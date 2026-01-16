import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-64px)]">
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
            <Link href="/chapters" className="btn-secondary text-lg px-8 py-3.5 w-full sm:w-auto">
              Find Your Chapter
            </Link>
          </div>
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

      {/* Contribute Section */}
      <section className="py-20 bg-labor-red-50 border-t border-labor-red-100">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
            Fund the fight
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            We don't take corporate money. Every dollar comes from working people like you.
            Your contribution—big or small—keeps us independent and accountable to you, not billionaires.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/contribute"
              className="btn-primary text-lg px-8 py-3.5 w-full sm:w-auto"
            >
              Contribute Now
            </Link>
            <span className="text-sm text-gray-500">100% funds the movement</span>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white tracking-tight">
            Stop waiting. Start fighting.
          </h2>
          <p className="mt-4 text-lg text-gray-400">
            Politicians won't save you. Organized people will. Join us.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/join"
              className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-gray-900 font-medium rounded-md hover:bg-gray-100 transition-colors"
            >
              Join the Labor Party
            </Link>
            <Link
              href="/contribute"
              className="inline-flex items-center justify-center px-8 py-3.5 border border-white/30 text-white font-medium rounded-md hover:bg-white/10 transition-colors"
            >
              Contribute
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
