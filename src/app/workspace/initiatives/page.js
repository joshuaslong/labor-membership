import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InitiativeRowActions from '@/components/InitiativeRowActions'

const STATUS_STYLES = {
  draft: 'bg-amber-50 text-amber-700',
  active: 'bg-green-50 text-green-700',
  completed: 'bg-blue-50 text-blue-700',
  archived: 'bg-stone-100 text-stone-500',
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  })
}

export default async function InitiativesPage({ searchParams: searchParamsPromise }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const searchParams = await searchParamsPromise
  const supabase = createAdminClient()

  let query = supabase
    .from('initiatives')
    .select('*')
    .order('display_order', { ascending: true })

  if (searchParams?.status) {
    query = query.eq('status', searchParams.status)
  }

  const { data: initiatives, error } = await query

  if (error) {
    console.error('Error fetching initiatives:', error)
    throw new Error('Failed to load initiatives')
  }

  const statusLabels = {
    draft: 'Draft Initiatives',
    active: 'Active Initiatives',
    completed: 'Completed Initiatives',
    archived: 'Archived Initiatives',
  }
  const pageTitle = searchParams?.status
    ? statusLabels[searchParams.status] || 'Initiatives'
    : 'All Initiatives'

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{pageTitle}</h1>
        <span className="text-xs text-gray-400 tabular-nums">
          {initiatives?.length || 0} initiative{initiatives?.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="bg-white border border-stone-200 rounded overflow-hidden">
        {!initiatives || initiatives.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-500">
            <p>No initiatives found.</p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-stone-100">
              {initiatives.map(initiative => (
                <Link key={initiative.id} href={`/workspace/initiatives/${initiative.id}`} className="block px-4 py-3 hover:bg-stone-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{initiative.title}</p>
                      {initiative.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{initiative.description}</p>
                      )}
                    </div>
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[initiative.status]}`}>
                      {initiative.status}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
                    <span>Order: {initiative.display_order}</span>
                    <span>Min: ${initiative.min_amount}</span>
                    <span>{formatDate(initiative.created_at)}</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop table */}
            <table className="hidden md:table min-w-full divide-y divide-stone-200">
              <thead className="bg-stone-50">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Initiative</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Amounts</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Order</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {initiatives.map(initiative => (
                  <tr key={initiative.id} className="hover:bg-stone-50">
                    <td className="px-4 py-3 text-sm">
                      <Link href={`/workspace/initiatives/${initiative.id}`} className="text-gray-900 hover:text-labor-red font-medium">
                        {initiative.title}
                      </Link>
                      {initiative.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{initiative.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[initiative.status]}`}>
                        {initiative.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {(initiative.suggested_amounts || []).map(a => `$${a}`).join(', ')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 tabular-nums">{initiative.display_order}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 tabular-nums">{formatDate(initiative.created_at)}</td>
                    <td className="px-4 py-3 text-sm">
                      <InitiativeRowActions initiativeId={initiative.id} initiativeTitle={initiative.title} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  )
}
