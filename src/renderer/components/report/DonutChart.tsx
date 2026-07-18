/** SVG Donut Chart แสดงสัดส่วน Created / Merged / Reviewed */
export default function DonutChart({ created, merged, reviewed }: { created: number; merged: number; reviewed: number }) {
  const total = created + merged + reviewed

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 bg-gray-950/20 border border-white/5 rounded-2xl p-5">
        <svg width="80" height="80" viewBox="0 0 36 36" className="animate-pulse">
          <circle cx="18" cy="18" r="15.915" fill="none" stroke="#27272a" strokeWidth="3" />
        </svg>
        <span className="text-[10px] text-gray-500 mt-3 font-bold uppercase tracking-wider">No Activity</span>
      </div>
    )
  }

  const createdPct = (created / total) * 100
  const mergedPct = (merged / total) * 100
  const reviewedPct = (reviewed / total) * 100

  const strokeCreated = `${createdPct} ${100 - createdPct}`
  const strokeMerged = `${mergedPct} ${100 - mergedPct}`
  const strokeReviewed = `${reviewedPct} ${100 - reviewedPct}`

  const offsetCreated = 100 - 25 // start at 12 o'clock
  const offsetMerged = offsetCreated - createdPct
  const offsetReviewed = offsetMerged - mergedPct

  return (
    <div className="relative flex items-center justify-center flex-shrink-0">
      <svg width="110" height="110" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#09090b" strokeWidth="3.5" />

        {/* Reviewed Segment (Blue) */}
        {reviewed > 0 && (
          <circle
            cx="18"
            cy="18"
            r="15.915"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3.5"
            strokeDasharray={strokeReviewed}
            strokeDashoffset={offsetReviewed}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        )}

        {/* Merged Segment (Green) */}
        {merged > 0 && (
          <circle
            cx="18"
            cy="18"
            r="15.915"
            fill="none"
            stroke="#10b981"
            strokeWidth="3.5"
            strokeDasharray={strokeMerged}
            strokeDashoffset={offsetMerged}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        )}

        {/* Created Segment (Orange) */}
        {created > 0 && (
          <circle
            cx="18"
            cy="18"
            r="15.915"
            fill="none"
            stroke="#f97316"
            strokeWidth="3.5"
            strokeDasharray={strokeCreated}
            strokeDashoffset={offsetCreated}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        )}
      </svg>

      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-xl font-black text-white tracking-tight">{total}</span>
        <span className="text-[7px] font-bold text-gray-500 uppercase tracking-widest">Total</span>
      </div>
    </div>
  )
}
