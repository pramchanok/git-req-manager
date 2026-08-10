import { Activity } from 'lucide-react'

export type ActivityDay = { timestamp: number; dayLabel: string; dateLabel?: string; count: number; created?: number; merged?: number }

/** กราฟแท่งกิจกรรมย้อนหลัง 7 วัน */
export default function ActivityBarChart({ data }: { data: ActivityDay[] }) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.created ?? d.count, d.merged ?? 0)), 1)

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-3 flex flex-col shadow-lg backdrop-blur-sm flex-shrink-0 relative">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-gray-800/60 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Activity className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300 truncate">Delivery Trend</span>
        </div>
        <div className="flex items-center gap-2.5 text-[9px] font-semibold text-gray-400 flex-shrink-0">
          <span className="flex items-center gap-1">
            <i className="h-1.5 w-1.5 rounded-full bg-orange-500 inline-block" />
            Created
          </span>
          <span className="flex items-center gap-1">
            <i className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
            Merged
          </span>
        </div>
      </div>

      <div className="flex items-end justify-between h-20 px-0.5 gap-1 relative">
        {data.map((d, idx) => {
          const createdVal = d.created ?? d.count
          const mergedVal = d.merged ?? 0
          const tooltipAlignClass = 
            idx === 0 
              ? 'left-0 translate-x-0' 
              : idx === data.length - 1 
              ? 'right-0 left-auto translate-x-0' 
              : 'left-1/2 -translate-x-1/2'

          return (
            <div key={idx} className="group relative flex h-full flex-1 flex-col items-center justify-end min-w-0">
              <span className={`pointer-events-none absolute bottom-8 z-30 scale-95 whitespace-nowrap rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-[9px] font-bold text-gray-200 opacity-0 shadow-2xl transition-all duration-150 group-hover:scale-100 group-hover:opacity-100 ${tooltipAlignClass}`}>
                <span className="text-orange-400">{createdVal} created</span> · <span className="text-emerald-400">{mergedVal} merged</span>{d.dateLabel ? ` (${d.dateLabel})` : ''}
              </span>
              <div className="w-full h-12 flex items-end justify-center mb-1.5">
                <div className="flex h-full w-full max-w-[28px] items-end justify-center gap-0.5 px-0.5">
                  <div 
                    style={{ height: `${Math.max((createdVal / maxVal) * 100, createdVal > 0 ? 12 : 0)}%` }} 
                    className={`flex-1 rounded-t-sm transition-all duration-300 ${
                      createdVal > 0 ? 'bg-gradient-to-t from-orange-600 to-orange-400 shadow-[0_0_6px_rgba(249,115,22,0.25)]' : 'bg-gray-800/40'
                    }`} 
                  />
                  <div 
                    style={{ height: `${Math.max((mergedVal / maxVal) * 100, mergedVal > 0 ? 12 : 0)}%` }} 
                    className={`flex-1 rounded-t-sm transition-all duration-300 ${
                      mergedVal > 0 ? 'bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.25)]' : 'bg-gray-800/40'
                    }`} 
                  />
                </div>
              </div>

              <span className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">{d.dayLabel}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
