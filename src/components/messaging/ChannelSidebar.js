'use client'

export default function ChannelSidebar({
  channels,
  selectedChannelId,
  onSelectChannel,
  onCreateChannel,
  onBrowseChannels,
  isAdmin,
  unreadCounts
}) {
  return (
    <div className="w-full md:w-64 border-r border-stone-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-200 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Channels</h2>
      </div>

      {/* Actions */}
      <div className="px-3 py-2 space-y-1 border-b border-stone-100 shrink-0">
        <button
          onClick={onBrowseChannels}
          className="w-full text-left px-2 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-stone-50 rounded flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Browse Channels
        </button>
        {isAdmin && (
          <button
            onClick={onCreateChannel}
            className="w-full text-left px-2 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-stone-50 rounded flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Channel
          </button>
        )}
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-1">
        {(!channels || channels.length === 0) ? (
          <div className="px-4 py-6 text-center text-xs text-gray-400">
            No channels yet
          </div>
        ) : (
          channels.map(channel => {
            const isSelected = channel.id === selectedChannelId
            const unread = unreadCounts?.[channel.id] || 0

            return (
              <button
                key={channel.id}
                onClick={() => onSelectChannel(channel.id)}
                className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-sm transition-colors ${
                  isSelected
                    ? 'bg-stone-200 text-gray-900 font-medium'
                    : 'text-gray-700 hover:bg-stone-50'
                }`}
              >
                <span className="text-gray-400 text-xs">#</span>
                <span className="truncate flex-1">{channel.name}</span>
                {unread > 0 && (
                  <span className="shrink-0 bg-labor-red text-white text-xs font-medium rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
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
