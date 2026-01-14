import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Labor Party Membership
        </h1>
        <p className="text-xl text-gray-600">
          Join thousands of everyday Americans building political power.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link href="/join" className="btn-primary text-lg px-8 py-3">
            Join Now
          </Link>
          <Link href="/chapters" className="btn-secondary text-lg px-8 py-3">
            Find Your Chapter
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-xl font-bold mb-2">Hierarchical Chapters</h2>
          <p className="text-gray-600">
            National, state, county, and city chapters. Members at any level 
            are automatically included in all levels above them.
          </p>
        </div>
        <div className="card">
          <h2 className="text-xl font-bold mb-2">Membership Dues</h2>
          <p className="text-gray-600">
            Secure payment processing via Stripe. Monthly or annual dues 
            with automatic renewal.
          </p>
        </div>
      </div>
    </div>
  )
}
