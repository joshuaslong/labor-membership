import { createClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const priorityColors = {
  P1: 'text-red-700 bg-red-50 border-red-200',
  P2: 'text-amber-700 bg-amber-50 border-amber-200',
  P3: 'text-gray-700 bg-stone-50 border-stone-200',
}

const statusColors = {
  NOT_STARTED: 'text-gray-700 bg-stone-50 border-stone-200',
  IN_PROGRESS: 'text-blue-700 bg-blue-50 border-blue-200',
  BLOCKED: 'text-red-700 bg-red-50 border-red-200',
  IN_REVIEW: 'text-amber-700 bg-amber-50 border-amber-200',
  DONE: 'text-green-700 bg-green-50 border-green-200',
}

const skillColors = {
  WRITING: 'text-purple-700 bg-purple-50 border-purple-200',
  DESIGN: 'text-pink-700 bg-pink-50 border-pink-200',
  VIDEO: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  TECHNICAL: 'text-cyan-700 bg-cyan-50 border-cyan-200',
  RESEARCH: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  COORDINATION: 'text-orange-700 bg-orange-50 border-orange-200',
}

function formatTime(min) {
  if (!min) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatDeadline(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.ceil((d - now) / (1000 * 60 * 60 * 24))

  if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, overdue: true }
  if (diff === 0) return { text: 'Today', overdue: false }
  if (diff === 1) return { text: 'Tomorrow', overdue: false }
  if (diff < 7) return { text: `${diff}d`, overdue: false }
  return {
    text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    overdue: false,
  }
}

const PAGE_SIZE = 50

export default async function TasksPage({ searchParams: searchParamsPromise }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const searchParams = await searchParamsPromise
  const supabase = await createClient()

  const page = Math.max(1, parseInt(searchParams?.page) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // Build query
  let query = supabase
    .from('tasks')
    .select(`
      id,
      name,
      project,
      status,
      priority,
      deadline,
      phase,
      time_estimate_min,
      skill_type,
      owner:team_members!tasks_owner_fkey(id, member:members(first_name, last_name))
    `, { count: 'exact' })
    .order('deadline', { ascending: true })
    .range(from, to)

  // Filters
  if (searchParams?.owner === 'me') {
    query = query.eq('owner', teamMember.id)
  }
  if (searchParams?.status) {
    query = query.eq('status', searchParams.status)
  }
  if (searchParams?.priority) {
    query = query.eq('priority', searchParams.priority)
  }
  if (searchParams?.search) {
    query = query.ilike('name', `%${searchParams.search}%`)
  }

  const { data: tasks, error, count: totalCount } = await query

  if (error) {
    throw new Error(`Failed to fetch tasks: ${error.message}`)
  }

  // Page title
  const titleMap = {
    NOT_STARTED: 'Not Started',
    IN_PROGRESS: 'In Progress',
    BLOCKED: 'Blocked',
    IN_REVIEW: 'In Review',
    DONE: 'Done',
  }
  let pageTitle = 'All Tasks'
  if (searchParams?.owner === 'me') pageTitle = 'My Tasks'
  else if (searchParams?.status) pageTitle = titleMap[searchParams.status] || 'Tasks'
  else if (searchParams?.priority) pageTitle = `${searchParams.priority} Tasks`

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE)

  function pageUrl(p) {
    const params = new URLSearchParams()
    if (searchParams?.owner) params.set('owner', searchParams.owner)
    if (searchParams?.status) params.set('status', searchParams.status)
    if (searchParams?.priority) params.set('priority', searchParams.priority)
    if (searchParams?.search) params.set('search', searchParams.search)
    if (p > 1) params.set('page', String(p))
    const qs = params.toString()
    return qs ? `/workspace/tasks?${qs}` : '/workspace/tasks'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{pageTitle}</h1>
          {totalCount != null && (
            <p className="text-xs text-gray-500 mt-0.5">
              {totalCount} {totalCount === 1 ? 'task' : 'tasks'}
            </p>
          )}
        </div>
        <Link
          href="/workspace/tasks/new"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-labor-red hover:bg-red-700 rounded transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </Link>
      </div>

      {/* Task List */}
      {!tasks || tasks.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded p-12 text-center">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-sm text-gray-500 mb-1">No tasks found</p>
          <Link href="/workspace/tasks/new" className="text-sm text-labor-red hover:underline">
            Create your first task
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded divide-y divide-stone-100">
          {tasks.map(task => {
            const dl = formatDeadline(task.deadline)
            const ownerName = task.owner?.member
              ? `${task.owner.member.first_name} ${task.owner.member.last_name}`
              : null

            return (
              <Link
                key={task.id}
                href={`/workspace/tasks/${task.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
              >
                {/* Status indicator */}
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  task.status === 'DONE' ? 'bg-green-500' :
                  task.status === 'BLOCKED' ? 'bg-red-500' :
                  task.status === 'IN_PROGRESS' ? 'bg-blue-500' :
                  task.status === 'IN_REVIEW' ? 'bg-amber-500' :
                  'bg-gray-300'
                }`} />

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${task.status === 'DONE' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {task.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-500">{task.project}</span>
                    {task.phase && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{task.phase}</span>
                      </>
                    )}
                    {ownerName && (
                      <>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{ownerName}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Badges */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {task.skill_type && (
                    <span className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${skillColors[task.skill_type] || 'text-gray-700 bg-stone-50 border-stone-200'}`}>
                      {task.skill_type}
                    </span>
                  )}
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${priorityColors[task.priority]}`}>
                    {task.priority}
                  </span>
                  <span className={`hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${statusColors[task.status]}`}>
                    {task.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Deadline & Time */}
                <div className="text-right flex-shrink-0 w-16">
                  <div className={`text-xs tabular-nums ${dl.overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    {dl.text}
                  </div>
                  {task.time_estimate_min && (
                    <div className="text-xs text-gray-400 tabular-nums">{formatTime(task.time_estimate_min)}</div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          {page > 1 ? (
            <Link
              href={pageUrl(page - 1)}
              className="px-3 py-1.5 border border-stone-200 rounded text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Previous
            </Link>
          ) : (
            <span className="px-3 py-1.5 border border-stone-100 rounded text-gray-300">Previous</span>
          )}
          <span className="text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link
              href={pageUrl(page + 1)}
              className="px-3 py-1.5 border border-stone-200 rounded text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Next
            </Link>
          ) : (
            <span className="px-3 py-1.5 border border-stone-100 rounded text-gray-300">Next</span>
          )}
        </div>
      )}
    </div>
  )
}
