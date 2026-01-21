import Link from 'next/link'

export const metadata = {
  title: 'Initiatives | Labor Party',
  description: 'Support Labor Party direct action campaigns. 100% of donations go directly to the cause.',
}

const INITIATIVES = [
  {
    slug: 'care-packages',
    title: 'ICE Protestor Care Packages',
    status: 'active',
    description: 'Providing water, food, first aid, and essential supplies to protestors standing up against ICE raids in our communities.',
    raised: null,
    goal: 5000,
  },
]

function InitiativeCard({ initiative }) {
  return (
    <div className="card-hover overflow-hidden">
      {/* Card Header */}
      <div className="p-6">
        <div className="mb-4">
          {initiative.status === 'active' && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-labor-red-50 text-labor-red text-xs font-medium">
              Active Campaign
            </span>
          )}
          {initiative.status === 'completed' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
              Completed
            </span>
          )}
        </div>

        <h3 className="text-xl font-semibold text-gray-900 tracking-tight mb-2">
          {initiative.title}
        </h3>

        <p className="text-gray-500 text-sm leading-relaxed">
          {initiative.description}
        </p>
      </div>

      {/* Progress Section */}
      {initiative.goal && (
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-500">
              {initiative.raised !== null ? (
                <>
                  <span className="font-semibold text-labor-red">
                    ${initiative.raised.toLocaleString()}
                  </span>
                  {' '}raised
                </>
              ) : (
                'Help us reach our goal'
              )}
            </span>
            <span className="text-gray-400 font-medium">${initiative.goal.toLocaleString()} goal</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-labor-red rounded-full transition-all"
              style={{ width: initiative.raised ? `${Math.min((initiative.raised / initiative.goal) * 100, 100)}%` : '0%' }}
            />
          </div>
        </div>
      )}

      {/* Card Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
        <Link
          href={`/initiatives/${initiative.slug}`}
          className="btn-primary w-full text-center block"
        >
          Support This Initiative
        </Link>
      </div>
    </div>
  )
}

export default function InitiativesPage() {
  const activeInitiatives = INITIATIVES.filter(i => i.status === 'active')
  const pastInitiatives = INITIATIVES.filter(i => i.status === 'completed')

  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Hero Section - Matching landing page style */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(226,85,85,0.06)_0%,_transparent_50%)]" />

        <div className="relative max-w-5xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-labor-red-50 text-labor-red-600 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-labor-red animate-pulse" />
            Direct Action Campaigns
          </div>

          <h1 className="text-4xl md:text-5xl text-gray-900 tracking-tight leading-tight">
            Initiatives
          </h1>

          <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Your donations go directly to the cause — the Labor Party covers all administrative costs.
            100% of what you give supports our communities.
          </p>
        </div>
      </section>

      {/* Active Initiatives */}
      <section className="py-12 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          {activeInitiatives.length > 0 ? (
            <>
              <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-8">Active Campaigns</h2>

              <div className="grid md:grid-cols-2 gap-6">
                {activeInitiatives.map((initiative) => (
                  <InitiativeCard key={initiative.slug} initiative={initiative} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 tracking-tight mb-2">No active campaigns</h3>
              <p className="text-gray-500 text-sm">Check back soon for new initiatives.</p>
            </div>
          )}
        </div>
      </section>

      {/* Past Initiatives */}
      {pastInitiatives.length > 0 && (
        <section className="py-12 border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-lg font-semibold text-gray-900 tracking-tight mb-8">Completed Campaigns</h2>

            <div className="grid md:grid-cols-2 gap-6">
              {pastInitiatives.map((initiative) => (
                <InitiativeCard key={initiative.slug} initiative={initiative} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section - Matching landing page dark section */}
      <section className="py-16 bg-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />

        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <p className="text-labor-red font-semibold text-sm tracking-wide uppercase mb-3">
            Get Involved
          </p>
          <h2 className="text-3xl md:text-4xl tracking-tight mb-4">
            <span className="text-gray-400">Have an idea?</span><br />
            <span className="text-white">Propose an initiative.</span>
          </h2>
          <p className="mt-4 text-gray-400 max-w-xl mx-auto">
            Members can propose campaigns that would help working people in their community.
            Join us and bring your idea to life.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/join"
              className="btn-primary text-lg px-8 py-3.5 w-full sm:w-auto"
            >
              Become a Member
            </Link>
            <Link
              href="/contribute"
              className="px-8 py-3.5 text-lg font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors w-full sm:w-auto text-center"
            >
              Support the Party
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
