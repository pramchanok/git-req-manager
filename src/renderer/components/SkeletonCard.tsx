export default function SkeletonCard() {
  return (
    <div className="pl-[10px] pr-3 py-2.5 border-b border-gray-700 border-l-2 border-l-transparent animate-pulse">
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full bg-gray-700 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="h-3 bg-gray-700 rounded w-3/4" />
          <div className="h-2.5 bg-gray-700 rounded w-1/2" />
          <div className="h-2 bg-gray-700 rounded w-2/5" />
        </div>
        <div className="h-4 w-10 bg-gray-700 rounded flex-shrink-0" />
      </div>
    </div>
  )
}

export function SkeletonDevRow() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-700 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3 bg-gray-700 rounded w-2/5" />
        <div className="h-2.5 bg-gray-700 rounded w-1/4" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-4 w-8 bg-gray-700 rounded" />
        <div className="h-4 w-8 bg-gray-700 rounded" />
      </div>
    </div>
  )
}
