import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'

async function getInitiatives() {
  const supabase = createAdminClient()

  const { data: initiatives } = await supabase
    .from('initiatives')
    .select('id, slug, title, description, status, image_url')
    .in('status', ['active', 'completed'])
    .order('display_order', { ascending: true })

  return initiatives || []
}

export default async function WorkspaceInitiativesPage() {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const initiatives = await getInitiatives()
  const activeInitiatives = initiatives.filter(i => i.status === 'active')
  const pastInitiatives = initiatives.filter(i => i.status === 'completed')

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Initiatives</h1>
        <p className="text-sm text-gray-500 mt-1">Support direct action campaigns. 100% of donations go directly to the cause.</p>
      </div>

      {/* Active Campaigns */}
      {activeInitiatives.length > 0 ? (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Active Campaigns</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {activeInitiatives.map(initiative => (
              <div key={initiative.id} className="bg-white border border-stone-200 rounded overflow-hidden">
                <div className="p-5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium mb-3">
                    Active
                  </span>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">{initiative.title}</h3>
                  {initiative.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">{initiative.description}</p>
                  )}
                </div>
                <div className="px-5 py-3 bg-stone-50 border-t border-stone-100">
                  <Link
                    href={`/initiatives/${initiative.slug}`}
                    className="text-sm font-medium text-labor-red hover:text-labor-red-dark"
                  >
                    Support this initiative →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded px-4 py-12 text-center mb-8">
          <p className="text-sm text-gray-500">No active campaigns right now. Check back soon.</p>
        </div>
      )}

      {/* Completed */}
      {pastInitiatives.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Completed</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {pastInitiatives.map(initiative => (
              <div key={initiative.id} className="bg-white border border-stone-200 rounded overflow-hidden">
                <div className="p-5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-medium mb-3">
                    Completed
                  </span>
                  <h3 className="text-base font-semibold text-gray-900 mb-1">{initiative.title}</h3>
                  {initiative.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">{initiative.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
