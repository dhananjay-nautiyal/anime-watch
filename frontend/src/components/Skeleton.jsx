export function CardSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl overflow-hidden">
          <div className="skeleton aspect-[3/4]" />
          <div className="p-3 space-y-2">
            <div className="skeleton h-3 rounded w-full" />
            <div className="skeleton h-3 rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function HeroSkeleton() {
  return (
    <div className="relative w-full" style={{ paddingTop: '45%' }}>
      <div className="absolute inset-0 skeleton rounded-2xl" />
      <div className="absolute bottom-0 left-0 p-10 space-y-4">
        <div className="skeleton h-10 w-96 rounded" />
        <div className="skeleton h-4 w-48 rounded" />
        <div className="skeleton h-4 w-80 rounded" />
        <div className="skeleton h-10 w-40 rounded-lg" />
      </div>
    </div>
  )
}

export function EpisodeSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-3 p-2 rounded-lg">
          <div className="skeleton w-20 h-14 rounded flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 rounded w-3/4" />
            <div className="skeleton h-2 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DetailSkeleton() {
  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="skeleton w-full lg:w-72 aspect-[3/4] rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-4">
          <div className="skeleton h-8 w-2/3 rounded" />
          <div className="skeleton h-4 w-1/3 rounded" />
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="flex gap-3 mt-4">
            <div className="skeleton h-10 w-32 rounded-lg" />
            <div className="skeleton h-10 w-32 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function RowSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 skeleton w-[190px] aspect-[3/4] rounded-[14px]" />
      ))}
    </div>
  )
}
