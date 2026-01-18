import Link from 'next/link'

const INITIATIVES = [
  {
    slug: 'care-packages',
    title: 'ICE Protestor Care Packages',
    status: 'active',
    description: 'Providing water, food, first aid, and essential supplies to protestors standing up against ICE raids in our communities.',
    raised: null, // Could be dynamically fetched
    goal: 5000,
    image: null,
    color: 'blue',
  },
  // Future initiatives can be added here
]

function InitiativeCard({ initiative }) {
  const colorClasses = {
    blue: {
      badge: 'bg-blue-100 text-blue-700',
      accent: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700',
      border: 'border-blue-200',
    },
    red: {
      badge: 'bg-labor-red-50 text-labor-red',
      accent: 'text-labor-red',
      button: 'bg-labor-red hover:bg-labor-red-dark',
      border: 'border-labor-red-100',
    },
    green: {
      badge: 'bg-green-100 text-green-700',
      accent: 'text-green-600',
      button: 'bg-green-600 hover:bg-green-700',
      border: 'border-green-200',
    },
  }

  const colors = colorClasses[initiative.color] || colorClasses.red

  return (
    <div className={`bg-white rounded-xl border ${colors.border} overflow-hidden transition-shadow hover:shadow-md`}>
      {/* Card Header */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {initiative.status === 'active' && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors.badge}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                Active Campaign
              </span>
            )}
          </div>
        </div>

        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {initiative.title}
        </h3>

        <p className="text-gray-600 text-sm leading-relaxed">
          {initiative.description}
        </p>
      </div>

      {/* Progress Section (if goal exists) */}
      {initiative.goal && (
        <div className="px-6 pb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-500">
              {initiative.raised !== null ? (
                <>
                  <span className={`font-semibold ${colors.accent}`}>
                    ${initiative.raised.toLocaleString()}
                  </span>
                  {' '}raised
                </>
              ) : (
                'Help us reach our goal'
              )}
            </span>
            <span className="text-gray-400">${initiative.goal.toLocaleString()} goal</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${colors.button} rounded-full transition-all`}
              style={{ width: initiative.raised ? `${Math.min((initiative.raised / initiative.goal) * 100, 100)}%` : '0%' }}
            />
          </div>
        </div>
      )}

      {/* Card Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
        <Link
          href={`/initiatives/${initiative.slug}`}
          className={`block w-full text-center ${colors.button} text-white font-medium py-3 px-6 rounded-lg transition-colors`}
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
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-gray-900 to-gray-800 text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Initiatives
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Direct action campaigns to support our communities. Your donations go directly
            to the cause — the Labor Party covers all administrative costs.
          </p>
        </div>
      </section>

      {/* Active Initiatives */}
      <section className="py-12">
        <div className="max-w-5xl mx-auto px-6">
          {activeInitiatives.length > 0 ? (
            <>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <h2 className="text-lg font-semibold text-gray-900">Active Campaigns</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {activeInitiatives.map((initiative) => (
                  <InitiativeCard key={initiative.slug} initiative={initiative} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No active campaigns</h3>
              <p className="text-gray-500 text-sm">Check back soon for new initiatives.</p>
            </div>
          )}
        </div>
      </section>

      {/* Past Initiatives */}
      {pastInitiatives.length > 0 && (
        <section className="py-12 border-t border-gray-200">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-8">Completed Campaigns</h2>

            <div className="grid md:grid-cols-2 gap-6">
              {pastInitiatives.map((initiative) => (
                <InitiativeCard key={initiative.slug} initiative={initiative} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-16 bg-white border-t border-gray-200">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Want to propose an initiative?
          </h2>
          <p className="text-gray-600 mb-8">
            Have an idea for a campaign that would help working people in your community?
            Members can propose initiatives to be organized through the Labor Party.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/join"
              className="btn-primary px-8 py-3 w-full sm:w-auto"
            >
              Become a Member
            </Link>
            <Link
              href="/contribute"
              className="btn-secondary px-8 py-3 w-full sm:w-auto"
            >
              Support the Party
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
