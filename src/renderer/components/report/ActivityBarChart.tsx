export type ActivityDay = { timestamp: number; dayLabel: string; dateLabel?: string; count: number }

/** กราฟแท่งกิจกรรมย้อนหลัง 7 วัน */
export default function ActivityBarChart({ data }: { data: ActivityDay[] }) {
  const maxVal = Math.max(...data.map((d) => d.count), 1)

  return (
    <div className="bg-gray-800/20 border border-white/5 rounded-2xl p-5 flex flex-col flex-1">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">7-Day Activity History</span>

      {/* Set h-full on parents and h-16 container on bars to fix percentage height rendering */}
      <div className="flex items-end justify-between h-28 px-1 gap-2">
        {data.map((d, idx) => {
          const heightPct = (d.count / maxVal) * 100
          return (
            <div key={idx} className="flex flex-col items-center justify-end flex-1 h-full group relative">
              <span className="absolute -top-8 scale-0 group-hover:scale-100 transition-all bg-gray-950 border border-gray-800 text-[9px] font-bold text-orange-400 px-2 py-0.5 rounded-md shadow-xl pointer-events-none z-10 whitespace-nowrap">
                {d.count} MRs {d.dateLabel ? `(${d.dateLabel})` : ''}
              </span>

              {/* Bar container of 64px height */}
              <div className="w-full h-16 flex items-end justify-center mb-2">
                <div
                  style={{ height: `${Math.max(heightPct, 8)}%` }} // Minimum 8% height so it is always visible
                  className={`w-5 rounded-t transition-all duration-300 cursor-pointer ${
                    d.count > 0
                      ? 'bg-gradient-to-t from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 shadow-md shadow-orange-600/5'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                ></div>
              </div>

              <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wide">{d.dayLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
