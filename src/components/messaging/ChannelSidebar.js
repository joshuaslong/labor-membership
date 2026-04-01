'use client'

function formatRelativeTime(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CHANNEL_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500'
]

function getChannelColor(name) {
  let hash = 0
  for (let i = 0; i < (name?.length || 0); i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return CHANNEL_COLORS[Math.abs(hash) % CHANNEL_COLORS.length]
}

function ChannelSkeleton() {
  return (
    <div className="px-4 md:px-3 py-3 md:py-2 flex items-center gap-3 md:gap-2 animate-pulse">
      <div className="w-10 h-10 md:w-5 md:h-5 rounded-full md:rounded bg-stone-200 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="h-3.5 bg-stone-200 rounded w-24 mb-1.5 md:mb-0" />
        <div className="h-3 bg-stone-100 rounded w-40 md:hidden" />
      </div>
    </div>
  )
}

export default function ChannelSidebar({
  channels,
  selectedChannelId,
  onSelectChannel,
  onCreateChannel,
  onBrowseChannels,
  isAdmin,
  unreadCounts,
  loading
}) {
  return (
    <div className="w-full md:w-64 border-r border-stone-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Channels</h2>
      </div>

      {/* Actions */}
      <div className="px-3 py-3 md:py-2 flex gap-2 md:block md:space-y-1 border-b border-stone-100 shrink-0">
        <button
          onClick={onBrowseChannels}
          className="flex-1 md:flex-none md:w-full text-center md:text-left px-3 md:px-2 py-2.5 md:py-1.5 text-sm md:text-xs font-medium md:font-normal text-gray-700 md:text-gray-600 bg-stone-50 md:bg-transparent hover:bg-stone-100 md:hover:bg-stone-50 border border-stone-200 md:border-0 rounded-lg md:rounded flex items-center justify-center md:justify-start gap-2 md:gap-1.5 transition-colors"
        >
          <svg className="w-4 h-4 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Browse
        </button>
        {isAdmin && (
          <button
            onClick={onCreateChannel}
            className="flex-1 md:flex-none md:w-full text-center md:text-left px-3 md:px-2 py-2.5 md:py-1.5 text-sm md:text-xs font-medium md:font-normal text-labor-red md:text-gray-600 bg-red-50 md:bg-transparent hover:bg-red-100 md:hover:bg-stone-50 border border-red-200 md:border-0 rounded-lg md:rounded flex items-center justify-center md:justify-start gap-2 md:gap-1.5 transition-colors"
          >
            <svg className="w-4 h-4 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create
          </button>
        )}
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <>
            <ChannelSkeleton />
            <ChannelSkeleton />
            <ChannelSkeleton />
          </>
        ) : (!channels || channels.length === 0) ? (
          <div className="px-4 py-12 text-center">
            <div className="text-gray-400 text-sm">No channels yet</div>
            <p className="text-xs text-gray-400 mt-1">Browse or create a channel to get started.</p>
          </div>
        ) : (
          channels.map(channel => {
            const isSelected = channel.id === selectedChannelId
            const unread = unreadCounts?.[channel.id] || 0
            const initial = (channel.name?.[0] || '#').toUpperCase()
            const preview = channel.last_message_preview
            const timeAgo = formatRelativeTime(channel.latest_message_at)

            return (
              <button
                key={channel.id}
                onClick={() => onSelectChannel(channel.id)}
                className={`w-full text-left px-4 md:px-3 py-3 md:py-1.5 flex items-center gap-3 md:gap-2 border-b border-stone-100 md:border-0 transition-colors active:bg-stone-100 ${
                  isSelected
                    ? 'bg-stone-100 md:bg-stone-200'
                    : 'hover:bg-stone-50'
                }`}
              >
                {/* Channel avatar (mobile) / icon (desktop) */}
                <div className={`w-10 h-10 md:hidden rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${getChannelColor(channel.name)}`}>
                  {channel.is_private ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  ) : initial}
                </div>
                {/* Desktop icon */}
                <span className="hidden md:inline text-xs shrink-0 text-gray-400">
                  {channel.is_private ? (
                    <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  ) : '#'}
                </span>

                {/* Channel info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`text-base md:text-sm truncate ${
                      unread > 0
                        ? 'font-semibold text-gray-900'
                        : isSelected
                          ? 'font-medium text-gray-900'
                          : 'text-gray-700'
                    }`}>
                      {channel.name}
                    </span>
                    {timeAgo && (
                      <span className={`text-[11px] md:hidden shrink-0 ${unread > 0 ? 'text-labor-red font-medium' : 'text-gray-400'}`}>
                        {timeAgo}
                      </span>
                    )}
                  </div>
                  {/* Message preview on mobile */}
                  <div className="md:hidden flex items-center gap-2 mt-0.5">
                    <span className={`text-xs truncate flex-1 ${unread > 0 ? 'text-gray-600' : 'text-gray-400'}`}>
                      {preview || channel.description || 'No messages yet'}
                    </span>
                    {unread > 0 && (
                      <span className="shrink-0 bg-labor-red text-white text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>

                {/* Desktop unread badge */}
                {unread > 0 && (
                  <span className="hidden md:flex shrink-0 bg-labor-red text-white text-xs font-medium rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
