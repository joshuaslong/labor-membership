import { getSegmentColor, getSegmentLabel } from '@/lib/segments'

export default function SegmentBadge({ segment }) {
  const colorClasses = getSegmentColor(segment)
  const label = getSegmentLabel(segment)

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${colorClasses}`}>
      {label}
    </span>
  )
}
