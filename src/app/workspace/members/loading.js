export default function MembersLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6 h-5 w-32 bg-stone-200 rounded animate-pulse" />
      <div className="bg-white border border-stone-200 rounded p-4">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-12 bg-stone-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
