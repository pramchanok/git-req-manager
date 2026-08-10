interface ContributionRadarProps {
  created: number
  merged: number
  reviewed: number
  open: number
  profiles?: Array<{
    name: string
    created: number
    merged: number
    reviewed: number
    open: number
  }>
}

const PROFILE_COLORS = [
  { stroke: '#fb923c', fill: 'rgba(251, 146, 60, 0.16)' },
  { stroke: '#60a5fa', fill: 'rgba(96, 165, 250, 0.12)' },
  { stroke: '#c084fc', fill: 'rgba(192, 132, 252, 0.12)' },
]

/** Balance chart. When profiles are supplied, each selected member is overlaid. */
export default function ContributionRadar({ created, merged, reviewed, open, profiles }: ContributionRadarProps) {
  const displayedProfiles = profiles?.length
    ? profiles
    : [{ name: 'Selected profile', created, merged, reviewed, open }]
  const max = Math.max(...displayedProfiles.flatMap((profile) => [profile.created, profile.merged, profile.reviewed, profile.open]), 1)
  const pointsFor = (profile: typeof displayedProfiles[number]) => {
    const scale = (value: number) => 45 * (value / max)
    return `100,${100 - scale(profile.created)} ${100 + scale(profile.merged)},100 100,${100 + scale(profile.reviewed)} ${100 - scale(profile.open)},100`
  }

  return (
    <section className="rounded-2xl border border-white/5 bg-gray-800/30 p-4 shadow-xl">
      <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{displayedProfiles.length > 1 ? 'Comparison balance' : 'Contribution balance'}</h2>
      <div className="mt-2 flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="h-36 w-36" role="img" aria-label="Contribution balance chart">
          <path d="M100 30 L170 100 L100 170 L30 100 Z" fill="none" stroke="#374151" strokeWidth="1" />
          <path d="M100 55 L145 100 L100 145 L55 100 Z" fill="none" stroke="#374151" strokeWidth="1" />
          <path d="M100 20 V180 M20 100 H180" stroke="#4b5563" strokeWidth="1" />
          {displayedProfiles.map((profile, index) => <polygon key={profile.name} points={pointsFor(profile)} fill={PROFILE_COLORS[index % PROFILE_COLORS.length].fill} stroke={PROFILE_COLORS[index % PROFILE_COLORS.length].stroke} strokeWidth="2" />)}
          <text x="100" y="13" textAnchor="middle" fill="#d1d5db" fontSize="10">Created</text>
          <text x="186" y="103" textAnchor="middle" fill="#d1d5db" fontSize="10">Merged</text>
          <text x="100" y="195" textAnchor="middle" fill="#d1d5db" fontSize="10">Reviewed</text>
          <text x="14" y="103" textAnchor="middle" fill="#d1d5db" fontSize="10">Open</text>
        </svg>
      </div>
      <div className="mt-1 space-y-1" aria-label="Chart legend">
        {displayedProfiles.map((profile, index) => <div key={profile.name} className="flex items-center gap-1.5 text-[9px] text-gray-400"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: PROFILE_COLORS[index % PROFILE_COLORS.length].stroke }} /><span className="truncate">{profile.name}</span></div>)}
      </div>
    </section>
  )
}
