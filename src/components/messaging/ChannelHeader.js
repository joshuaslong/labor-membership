'use client'

export default function ChannelHeader({ channel }) {
  if (!channel) return null

  return (
    <div className="border-b border-stone-200 bg-white px-4 py-3">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-gray-900 truncate">
          # {channel.name}
        </h2>
        {channel.description && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{channel.description}</p>
        )}
      </div>
      {channel.member_count != null && (
        <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0 ml-4">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{channel.member_count}</span>
        </div>
      )}
      </div>
    </div>
  )
}
