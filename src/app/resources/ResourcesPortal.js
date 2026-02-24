import Link from 'next/link'

function CollectionCard({ collection, basePath }) {
  const href = `${basePath}/${collection.slug}`

  return (
    <Link
      href={href}
      className="bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden hover:border-stone-300 hover:shadow transition-all group"
    >
      {/* Thumbnail */}
      <div className="aspect-[16/9] bg-gradient-to-br from-stone-100 to-stone-200 relative overflow-hidden">
        {collection.thumbnailFileId ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/files/preview/${collection.thumbnailFileId}`}
            alt=""
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-10 h-10 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-900 group-hover:text-labor-red transition-colors">
          {collection.name}
        </h3>
        {collection.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{collection.description}</p>
        )}
        <div className="flex items-center gap-2 mt-3">
          <span className="inline-flex items-center text-xs text-gray-400 bg-stone-50 px-2 py-0.5 rounded-full">
            {collection.assetCount} {collection.assetCount === 1 ? 'asset' : 'assets'}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function ResourcesPortal({
  collections = [],
  title = 'Resources',
  subtitle,
  chapterName,
  basePath = '/resources/c',
}) {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        {chapterName && (
          <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-1">{chapterName}</p>
        )}
        <h1 className="text-2xl font-medium tracking-tight text-gray-900">{title}</h1>
        {subtitle && (
          <p className="text-sm text-gray-500 mt-1.5 max-w-2xl">{subtitle}</p>
        )}
      </div>

      {/* Grid */}
      {collections.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-12 h-12 text-stone-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-sm text-gray-500">No collections available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              basePath={basePath}
            />
          ))}
        </div>
      )}
    </div>
  )
}
