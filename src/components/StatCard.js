export default function StatCard({ label, value, subtext, valueColor = 'text-gray-900' }) {
  return (
    <div className="bg-white border border-stone-200 rounded p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 font-medium mb-1">
        {label}
      </div>
      <div className={`text-2xl font-semibold ${valueColor} tabular-nums`}>
        {value}
      </div>
      {subtext && (
        <div className="text-xs text-gray-600 mt-0.5">
          {subtext}
        </div>
      )}
    </div>
  )
}
