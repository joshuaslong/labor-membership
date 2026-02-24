import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentTeamMember } from '@/lib/teamMember'
import { getHomePageData } from '@/lib/workspaceHome'
import { canAccessSection } from '@/lib/permissions'

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h, 10)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return m === '00' ? `${hour12}${ampm}` : `${hour12}:${m}${ampm}`
}

function formatDeadline(dateStr) {
  if (!dateStr) return null
  const deadline = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((deadline - today) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  return `${diffDays}d left`
}

function roleBadgeLabel(roles) {
  if (!roles?.length) return 'Team Member'
  const labels = {
    super_admin: 'Super Admin',
    national_admin: 'National Admin',
    state_admin: 'State Admin',
    county_admin: 'County Admin',
    city_admin: 'City Admin',
    event_coordinator: 'Event Coordinator',
    communications_lead: 'Comms Lead',
    volunteer_manager: 'Volunteer Manager',
    membership_coordinator: 'Membership Coord.',
    content_creator: 'Content Creator',
    data_manager: 'Data Manager',
    team_member: 'Team Member',
  }
  // Show highest-priority role
  for (const [key, label] of Object.entries(labels)) {
    if (roles.includes(key)) return label
  }
  return 'Team Member'
}

export default async function WorkspacePage() {
  const teamMember = await getCurrentTeamMember()
  if (!teamMember) redirect('/login')

  const { events, tasks, polls, unread, shifts } = await getHomePageData(teamMember)

  const firstName = teamMember.member?.first_name || 'there'
  const chapterName = teamMember.chapters?.name || null
  const roleLabel = roleBadgeLabel(teamMember.roles)

  // Quick links based on permissions
  const quickLinks = []
  if (canAccessSection(teamMember.roles, 'events')) {
    quickLinks.push({ label: 'Create Event', href: '/workspace/events/new' })
  }
  if (canAccessSection(teamMember.roles, 'resources')) {
    quickLinks.push({ label: 'View Resources', href: '/workspace/resources' })
  }
  if (canAccessSection(teamMember.roles, 'organize')) {
    quickLinks.push({ label: 'Organize', href: '/workspace/organize' })
  }
  if (canAccessSection(teamMember.roles, 'communicate')) {
    quickLinks.push({ label: 'Send Email', href: '/workspace/communicate' })
  }
  if (canAccessSection(teamMember.roles, 'admin')) {
    quickLinks.push({ label: 'Admin Dashboard', href: '/workspace/admin' })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
          Welcome back, {firstName}
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-gray-700">
            {roleLabel}
          </span>
          {chapterName && (
            <span className="text-xs text-gray-500">{chapterName}</span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column — what's happening */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Events */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Upcoming Events</h2>
              <Link href="/workspace/events" className="text-xs text-gray-500 hover:text-gray-700">View all</Link>
            </div>
            {events.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No upcoming events
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {events.map(event => (
                  <li key={event.id}>
                    <Link href={`/workspace/events/${event.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-stone-50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{event.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">
                            {formatDate(event.start_date)}
                            {event.start_time && ` · ${formatTime(event.start_time)}`}
                          </span>
                          {event.is_virtual ? (
                            <span className="text-xs text-blue-600">Virtual</span>
                          ) : event.location_city ? (
                            <span className="text-xs text-gray-400">
                              {event.location_city}{event.location_state ? `, ${event.location_state}` : ''}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-gray-300 shrink-0 ml-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Polls Needing Vote */}
          {polls.length > 0 && (
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Polls Needing Your Vote</h2>
                <Link href="/workspace/polls?filter=needs_vote" className="text-xs text-gray-500 hover:text-gray-700">View all</Link>
              </div>
              <ul className="divide-y divide-stone-100">
                {polls.map(poll => (
                  <li key={poll.id}>
                    <Link href={`/workspace/polls/${poll.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-stone-50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{poll.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {poll.question_count} question{poll.question_count !== 1 ? 's' : ''}
                          {poll.closes_at && ` · Closes ${formatDate(poll.closes_at)}`}
                        </p>
                      </div>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 shrink-0 ml-3">
                        Vote
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Unread Messages */}
          <Link
            href="/workspace/messaging"
            className="block bg-white border border-stone-200 rounded px-4 py-4 hover:bg-stone-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${unread > 0 ? 'bg-labor-red' : 'bg-stone-100'}`}>
                  <svg className={`w-4.5 h-4.5 ${unread > 0 ? 'text-white' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {unread > 0 ? `${unread} unread message${unread !== 1 ? 's' : ''}` : 'No unread messages'}
                  </p>
                  <p className="text-xs text-gray-500">Open messages</p>
                </div>
              </div>
              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Right column — what I need to do */}
        <div className="space-y-6">
          {/* My Tasks */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">My Tasks</h2>
              <Link href="/workspace/tasks?owner=me" className="text-xs text-gray-500 hover:text-gray-700">View all</Link>
            </div>
            {tasks.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No open tasks
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {tasks.map(task => {
                  const deadlineLabel = formatDeadline(task.deadline)
                  const isOverdue = deadlineLabel?.includes('overdue')
                  return (
                    <li key={task.id}>
                      <Link href={`/workspace/tasks/${task.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${
                          task.status === 'BLOCKED' ? 'bg-red-400' :
                          task.status === 'IN_PROGRESS' ? 'bg-blue-400' :
                          task.status === 'IN_REVIEW' ? 'bg-purple-400' :
                          'bg-gray-300'
                        }`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900 truncate">{task.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {task.priority && (
                              <span className="text-xs text-gray-400">{task.priority}</span>
                            )}
                            {deadlineLabel && (
                              <span className={`text-xs ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                                {deadlineLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Volunteer Shifts */}
          <div className="bg-white border border-stone-200 rounded">
            <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">My Shifts</h2>
              <Link href="/workspace/organize" className="text-xs text-gray-500 hover:text-gray-700">Browse</Link>
            </div>
            {shifts.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                No upcoming shifts
              </div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {shifts.map(shift => (
                  <li key={shift.id}>
                    <Link href={`/workspace/organize/${shift.id}`} className="block px-4 py-3 hover:bg-stone-50">
                      <p className="text-sm font-medium text-gray-900">{shift.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">
                          {formatDate(shift.event_date)}
                          {shift.start_time && ` · ${formatTime(shift.start_time)}`}
                        </span>
                        {shift.is_remote && (
                          <span className="text-xs text-blue-600">Remote</span>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick Links */}
          {quickLinks.length > 0 && (
            <div className="bg-white border border-stone-200 rounded">
              <div className="px-4 py-3 border-b border-stone-200">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Quick Links</h2>
              </div>
              <div className="p-2">
                {quickLinks.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="block px-3 py-1.5 text-sm text-gray-700 hover:bg-stone-50 rounded"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
