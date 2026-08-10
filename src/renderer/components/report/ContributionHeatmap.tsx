export interface ContributionDay {
  date: string
  label: string
  count: number
}

function shade(count: number, max: number): string {
  if (count === 0) return 'bg-gray-800/80'
  const ratio = count / Math.max(max, 1)
  if (ratio <= 0.25) return 'bg-green-950'
  if (ratio <= 0.5) return 'bg-green-800'
  if (ratio <= 0.75) return 'bg-green-600'
  return 'bg-green-400'
}

/** GitHub-style daily activity map for MR events in the past year. */
export default function ContributionHeatmap({ data, loading }: { data: ContributionDay[]; loading: boolean }) {
  const max = Math.max(...data.map((day) => day.count), 1)
  const total = data.reduce((sum, day) => sum + day.count, 0)
  const weeks = Math.ceil(data.length / 7)
  const monthLabels = data.flatMap((day, index) => {
    const date = new Date(`${day.date}T00:00:00`)
    const isFirstDay = index === 0 || date.getDate() === 1
    if (!isFirstDay) return []
    return [{ label: date.toLocaleString('en-US', { month: 'short' }), column: Math.floor(index / 7) + 1 }]
  })

  return (
    <section className="rounded-2xl border border-white/5 bg-gray-800/30 p-5 shadow-xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">MR activity, last 365 days</h2>
          <p className="mt-1 text-xs font-semibold text-gray-200">
            {loading ? 'Loading activity from GitLab…' : `${total} contribution events`}
          </p>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-gray-500" aria-label="Activity intensity legend">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => <span key={level} className={`h-2.5 w-2.5 rounded-sm ${shade(level, 4)}`} />)}
          <span>More</span>
        </div>
      </div>
      <div className="mb-1 grid gap-1 text-[9px] font-semibold text-gray-500" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }} aria-hidden="true">
        {monthLabels.map((month) => (
          <span key={`${month.label}-${month.column}`} style={{ gridColumnStart: month.column }} className="whitespace-nowrap">{month.label}</span>
        ))}
      </div>
      <div className={`grid grid-flow-col grid-rows-7 gap-1 ${loading ? 'animate-pulse opacity-60' : ''}`} style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }} aria-label="Contribution heatmap">
        {data.map((day) => (
          <span
            key={day.date}
            title={`${day.label}: ${day.count} MR activity event${day.count === 1 ? '' : 's'}`}
            className={`aspect-square w-full rounded-[2px] ${loading ? 'bg-gray-700/70' : shade(day.count, max)} transition-colors`}
          />
        ))}
      </div>
      <p className="mt-3 text-[9px] leading-relaxed text-gray-500">
        {data[0]?.label} – {data[data.length - 1]?.label} · Counts MR creation, merge completion, and review-assigned activity available from GitLab.
      </p>
    </section>
  )
}
