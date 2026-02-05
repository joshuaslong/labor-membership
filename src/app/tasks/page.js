import { createClient } from '@/lib/supabase/server'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { redirect } from 'next/navigation'

export default async function TasksPage({ searchParams }) {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  // Using createClient() instead of createAdminClient() as this is a server component
  // accessing data scoped to the current user's session
  const supabase = await createClient()

  // Build query
  let query = supabase
    .from('tasks')
    .select(`
      id,
      name,
      status,
      priority,
      deadline,
      phase,
      time_estimate_min,
      owner:team_members(id, member:members(first_name, last_name))
    `)
    .order('deadline', { ascending: true })
    .limit(50)

  // Filter by owner if specified
  if (searchParams?.owner === 'me') {
    query = query.eq('owner', teamMember.id)
  }

  // Filter by status if specified
  if (searchParams?.status) {
    query = query.eq('status', searchParams.status)
  }

  // Filter by priority if specified
  if (searchParams?.priority) {
    query = query.eq('priority', searchParams.priority)
  }

  const { data: tasks, error } = await query

  if (error) {
    throw new Error(`Failed to fetch tasks: ${error.message}`)
  }

  const priorityColors = {
    P1: 'text-red-700 bg-red-50 border-red-200',
    P2: 'text-amber-700 bg-amber-50 border-amber-200',
    P3: 'text-gray-700 bg-stone-50 border-stone-200'
  }

  const statusColors = {
    NOT_STARTED: 'text-gray-700 bg-stone-50 border-stone-200',
    IN_PROGRESS: 'text-blue-700 bg-blue-50 border-blue-200',
    BLOCKED: 'text-red-700 bg-red-50 border-red-200',
    IN_REVIEW: 'text-amber-700 bg-amber-50 border-amber-200',
    DONE: 'text-green-700 bg-green-50 border-green-200'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Tasks</h1>
        <a
          href="/tasks/new"
          className="px-4 py-2 bg-labor-red text-white rounded font-medium hover:bg-labor-red-600"
        >
          Create Task
        </a>
      </div>

      <div className="bg-white border border-stone-200 rounded overflow-hidden">
        <table className="min-w-full divide-y divide-stone-200" aria-label="Tasks list">
          <caption className="sr-only">List of tasks</caption>
          <thead className="bg-stone-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Task</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Owner</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Priority</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Deadline</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Est. Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {tasks?.map(task => (
              <tr key={task.id} className="hover:bg-stone-50">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">{task.name}</div>
                  {task.phase && <div className="text-xs text-gray-500">{task.phase}</div>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {task.owner?.member ? `${task.owner.member.first_name} ${task.owner.member.last_name}` : 'Unassigned'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusColors[task.status]}`}>
                    {task.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${priorityColors[task.priority]}`}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                  {new Date(task.deadline).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 tabular-nums">
                  {task.time_estimate_min ? `${Math.floor(task.time_estimate_min / 60)}h ${task.time_estimate_min % 60}m` : 'N/A'}
                </td>
              </tr>
            ))}
            {(!tasks || tasks.length === 0) && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  No tasks found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
