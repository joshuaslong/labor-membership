export default function WorkspaceLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6 h-7 w-64 bg-stone-200 rounded animate-pulse" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white border border-stone-200 rounded p-4 h-24 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="bg-white border border-stone-200 rounded h-64 animate-pulse" />
      </div>
    </div>
  )
}
