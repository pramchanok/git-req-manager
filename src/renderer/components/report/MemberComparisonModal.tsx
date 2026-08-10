import React, { useState, useMemo, useRef, useEffect, Component, type ReactNode } from 'react'
import { X, Users, Trophy, GitPullRequest, GitMerge, Eye, Clock, Award, Check, Plus, Search, BarChart3, TrendingUp, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react'
import type { GitLabUser } from '../../../shared/types'
import type { Timeframe } from '../../utils/timeframe'

export interface ComparisonMemberRow {
  member: GitLabUser
  created: number
  merged: number
  reviewed: number
  open: number
  averageLeadHours?: number | null
  mergeRate?: number | null
  total: number
}

interface MemberComparisonModalProps {
  isOpen: boolean
  onClose: () => void
  members: GitLabUser[]
  selectedUsername: string
  comparisonUsernames: string[]
  toggleComparisonUser: (username: string) => void
  comparisonRows: ComparisonMemberRow[]
  timeframe: Timeframe
  setTimeframe: (t: Timeframe) => void
  timeframeLabel: string
  onNavigateTimeframe: (direction: 'prev' | 'next') => void
}

function formatLeadTime(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || isNaN(hours)) return '—'
  if (hours < 24) return `${Math.round(hours)}h`
  return `${(hours / 24).toFixed(hours < 240 ? 1 : 0)}d`
}

const COLOR_SCHEMES = [
  {
    border: 'border-orange-500/40',
    bg: 'bg-orange-500/5',
    headerBg: 'bg-orange-500/10',
    accentText: 'text-orange-400',
    badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    barBg: 'bg-gradient-to-t from-orange-600 to-orange-400',
    avatarBorder: 'border-orange-500/60',
    tag: 'Member 1',
    colorHex: '#f97316',
  },
  {
    border: 'border-blue-500/40',
    bg: 'bg-blue-500/5',
    headerBg: 'bg-blue-500/10',
    accentText: 'text-blue-400',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    barBg: 'bg-gradient-to-t from-blue-600 to-blue-400',
    avatarBorder: 'border-blue-500/60',
    tag: 'Member 2',
    colorHex: '#3b82f6',
  },
  {
    border: 'border-purple-500/40',
    bg: 'bg-purple-500/5',
    headerBg: 'bg-purple-500/10',
    accentText: 'text-purple-400',
    badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    barBg: 'bg-gradient-to-t from-purple-600 to-purple-400',
    avatarBorder: 'border-purple-500/60',
    tag: 'Member 3',
    colorHex: '#a855f7',
  },
]

class ModalErrorBoundary extends Component<{ children: ReactNode; onClose: () => void }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; onClose: () => void }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('MemberComparisonModal Error Boundary caught an error:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-6">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-2xl">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
            <h3 className="text-base font-bold text-white">Comparison Panel Error</h3>
            <p className="text-xs text-gray-400">
              An unexpected error occurred while rendering the comparison view.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false })
                this.props.onClose()
              }}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function MemberComparisonModalContent({
  isOpen,
  onClose,
  members = [],
  selectedUsername,
  comparisonUsernames = [],
  toggleComparisonUser,
  comparisonRows = [],
  timeframe,
  setTimeframe,
  timeframeLabel,
  onNavigateTimeframe,
}: MemberComparisonModalProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [memberSearchQuery, setMemberSearchQuery] = useState('')
  const [bodySearchQuery, setBodySearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!isOpen) return null

  const safeMembers = members || []
  const safeComparisonUsernames = comparisonUsernames || []
  const safeComparisonRows = (comparisonRows || []).filter(r => r && r.member)

  // Available members to add (not currently selected)
  const availableMembers = safeMembers.filter(
    (m) => m && m.username && !safeComparisonUsernames.includes(m.username)
  )

  const filteredAvailableMembers = (() => {
    if (!memberSearchQuery.trim()) return availableMembers
    const q = memberSearchQuery.toLowerCase()
    return availableMembers.filter(
      (m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.username || '').toLowerCase().includes(q)
    )
  })()

  // Filtered members for body selection grid when < 2 selected
  const filteredBodyMembers = (() => {
    if (!bodySearchQuery.trim()) return safeMembers
    const q = bodySearchQuery.toLowerCase()
    return safeMembers.filter(
      (m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.username || '').toLowerCase().includes(q)
    )
  })()

  // Calculate top values for badges
  const maxCreated = safeComparisonRows.length > 0 ? Math.max(...safeComparisonRows.map((r) => r.created || 0), 0) : 0
  const maxMerged = safeComparisonRows.length > 0 ? Math.max(...safeComparisonRows.map((r) => r.merged || 0), 0) : 0
  const maxReviewed = safeComparisonRows.length > 0 ? Math.max(...safeComparisonRows.map((r) => r.reviewed || 0), 0) : 0

  const validLeadTimes = safeComparisonRows
    .map((r) => r.averageLeadHours)
    .filter((h): h is number => typeof h === 'number' && !isNaN(h) && h >= 0)
  const minLeadTime = validLeadTimes.length > 0 ? Math.min(...validLeadTimes) : null

  // Identify top performers
  const topCreatedUser = safeComparisonRows.find((r) => maxCreated > 0 && (r.created || 0) === maxCreated)
  const topMergedUser = safeComparisonRows.find((r) => maxMerged > 0 && (r.merged || 0) === maxMerged)
  const topReviewedUser = safeComparisonRows.find((r) => maxReviewed > 0 && (r.reviewed || 0) === maxReviewed)
  const fastestUser = safeComparisonRows.find((r) => minLeadTime !== null && r.averageLeadHours === minLeadTime)

  // Max value for bar scaling
  const globalMaxOutput = Math.max(
    ...safeComparisonRows.flatMap((r) => [r.created || 0, r.merged || 0, r.reviewed || 0]),
    1
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 sm:p-6 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Compare team members"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] bg-gray-900 border border-gray-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white select-text"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Modal Header Bar */}
        <div className="px-6 py-4 bg-gray-950/80 border-b border-gray-800 flex items-center justify-between flex-shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Team Member Comparison
                </h2>
                <span className="bg-gray-800 border border-gray-700 text-gray-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {safeComparisonRows.length}/3 Selected
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{timeframeLabel}</p>
            </div>
          </div>

          {/* Timeframe Controls in Header */}
          <div className="flex items-center gap-2.5">
            {/* Mode Pills: Day | Week | Month | Year */}
            <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl p-0.5 shadow-inner">
              {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTimeframe(t)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                    timeframe === t
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                  }`}
                >
                  {t === 'daily' ? 'Day' : t === 'weekly' ? 'Week' : t === 'monthly' ? 'Month' : 'Year'}
                </button>
              ))}
            </div>

            {/* Stepper Controls */}
            <div className="flex items-center gap-0.5 bg-gray-900 border border-gray-800 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => onNavigateTimeframe('prev')}
                className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
                title="Previous period"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigateTimeframe('next')}
                className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
                title="Next period"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white flex items-center justify-center transition-colors ml-1"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Member Selector Bar */}
        <div className="px-6 py-3 bg-gray-950/40 border-b border-gray-800/80 flex items-center justify-between gap-3 flex-shrink-0">
          {/* Active Selected Members Chips */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex-shrink-0">Comparing:</span>
            {safeComparisonRows.map((row, idx) => {
              const scheme = COLOR_SCHEMES[idx % COLOR_SCHEMES.length]
              const memberName = row.member?.name || row.member?.username || 'Member'
              const memberUsername = row.member?.username || ''
              const isFocused = memberUsername === selectedUsername

              return (
                <div
                  key={row.member?.id || memberUsername || idx}
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-xl text-xs font-semibold border shadow-sm transition-all ${scheme.badgeBg}`}
                >
                  {row.member?.avatarUrl ? (
                    <img src={row.member.avatarUrl} alt={memberName} className="w-4 h-4 rounded-full object-cover" />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-gray-800 flex items-center justify-center text-[9px]">🦊</span>
                  )}
                  <span className="truncate max-w-[140px]">{memberName}</span>
                  {isFocused && (
                    <span className="text-[9px] bg-orange-500/30 text-orange-200 px-1.5 py-0.2 rounded-md font-bold">Main</span>
                  )}
                  {safeComparisonUsernames.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleComparisonUser(memberUsername)}
                      className="text-gray-400 hover:text-white rounded hover:bg-black/20 p-0.5 transition-colors"
                      title="Remove member"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )
            })}

            {/* Dropdown Button to Add Member */}
            {safeComparisonUsernames.length < 3 && (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700/80 transition-colors shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5 text-orange-400" />
                  Add Member
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute left-0 top-full mt-2 w-64 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col p-2 gap-1 animate-fadeIn">
                    <div className="relative px-1 pt-1 pb-1.5">
                      <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search member..."
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                        className="w-full bg-gray-950 border border-gray-800 text-white text-xs rounded-lg pl-8 pr-2 py-1 outline-none focus:border-orange-500"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {filteredAvailableMembers.length === 0 ? (
                        <div className="text-[10px] text-gray-500 p-2 text-center">No available members</div>
                      ) : (
                        filteredAvailableMembers.map((member) => (
                          <button
                            key={member.id || member.username}
                            type="button"
                            onClick={() => {
                              toggleComparisonUser(member.username)
                              setIsDropdownOpen(false)
                              setMemberSearchQuery('')
                            }}
                            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-800 text-left text-xs transition-colors"
                          >
                            <span className="truncate text-gray-200 font-semibold">{member.name || member.username}</span>
                            <span className="text-[10px] text-gray-500">@{member.username}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <span className="text-[10px] text-gray-400 hidden sm:block">
            {safeComparisonUsernames.length}/3 Members Selected
          </span>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {safeComparisonRows.length < 2 ? (
            /* Interactive Member Picker Grid directly in Body */
            <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-6 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-orange-400" />
                    <span>Select Team Members to Compare</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Choose 2 to 3 team members below to view side-by-side performance metrics & charts.
                  </p>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search member name..."
                    value={bodySearchQuery}
                    onChange={(e) => setBodySearchQuery(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 text-white text-xs rounded-xl pl-9 pr-3 py-1.5 outline-none focus:border-orange-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {filteredBodyMembers.map((member) => {
                  const isSelected = safeComparisonUsernames.includes(member.username)
                  const selectedIdx = safeComparisonUsernames.indexOf(member.username)
                  const scheme = isSelected && selectedIdx >= 0 ? COLOR_SCHEMES[selectedIdx % COLOR_SCHEMES.length] : null

                  return (
                    <div
                      key={member.id || member.username}
                      onClick={() => toggleComparisonUser(member.username)}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer shadow-sm group ${
                        isSelected && scheme
                          ? `${scheme.border} ${scheme.bg} shadow-md`
                          : 'border-gray-800 bg-gray-900/60 hover:border-gray-700 hover:bg-gray-800/80'
                      } ${!isSelected && safeComparisonUsernames.length >= 3 ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className={`w-9 h-9 rounded-full object-cover border ${isSelected && scheme ? scheme.avatarBorder : 'border-gray-700'}`}
                          />
                        ) : (
                          <div className={`w-9 h-9 rounded-full bg-gray-800 border flex items-center justify-center text-sm ${isSelected && scheme ? scheme.avatarBorder : 'border-gray-700'}`}>
                            🦊
                          </div>
                        )}
                        <div className="min-w-0">
                          <h4 className={`text-xs font-bold truncate transition-colors ${isSelected && scheme ? scheme.accentText : 'text-gray-200 group-hover:text-white'}`}>
                            {member.name || member.username}
                          </h4>
                          <p className="text-[10px] text-gray-500 truncate">@{member.username}</p>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {isSelected ? (
                          <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border ${scheme?.badgeBg}`}>
                            <Check className="w-3 h-3" />
                            <span>Comparing</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={safeComparisonUsernames.length >= 3}
                            className="flex items-center gap-1 text-[10px] font-bold text-gray-400 group-hover:text-white bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded-lg border border-gray-700 transition-colors disabled:opacity-40"
                          >
                            <Plus className="w-3 h-3 text-orange-400" />
                            <span>Select</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <>
              {/* Executive Insights Highlights Bar */}
              <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4 shadow-md backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-3 border-b border-gray-800/60 pb-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">
                    Period Highlights
                  </h3>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {topCreatedUser && (
                    <div className="bg-gray-900/80 border border-gray-800 p-2.5 rounded-xl flex items-center gap-2.5">
                      <Award className="w-4 h-4 text-orange-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Top Created</span>
                        <span className="text-xs font-bold text-orange-300 truncate block">{topCreatedUser.member?.name || topCreatedUser.member?.username}</span>
                        <span className="text-[10px] text-gray-400 font-semibold">{topCreatedUser.created || 0} MRs</span>
                      </div>
                    </div>
                  )}

                  {topMergedUser && (
                    <div className="bg-gray-900/80 border border-gray-800 p-2.5 rounded-xl flex items-center gap-2.5">
                      <GitMerge className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Top Merged</span>
                        <span className="text-xs font-bold text-emerald-300 truncate block">{topMergedUser.member?.name || topMergedUser.member?.username}</span>
                        <span className="text-[10px] text-gray-400 font-semibold">{topMergedUser.merged || 0} MRs</span>
                      </div>
                    </div>
                  )}

                  {topReviewedUser && (
                    <div className="bg-gray-900/80 border border-gray-800 p-2.5 rounded-xl flex items-center gap-2.5">
                      <Eye className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Top Reviewer</span>
                        <span className="text-xs font-bold text-blue-300 truncate block">{topReviewedUser.member?.name || topReviewedUser.member?.username}</span>
                        <span className="text-[10px] text-gray-400 font-semibold">{topReviewedUser.reviewed || 0} Reviews</span>
                      </div>
                    </div>
                  )}

                  {fastestUser && minLeadTime !== null && (
                    <div className="bg-gray-900/80 border border-gray-800 p-2.5 rounded-xl flex items-center gap-2.5">
                      <Clock className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Fastest Lead Time</span>
                        <span className="text-xs font-bold text-purple-300 truncate block">{fastestUser.member?.name || fastestUser.member?.username}</span>
                        <span className="text-[10px] text-gray-400 font-semibold">{formatLeadTime(minLeadTime)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Grouped Comparison Bar Charts */}
              <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4 shadow-md backdrop-blur-sm">
                <div className="flex items-center justify-between gap-2 border-b border-gray-800/80 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-orange-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-200">
                      Visual Activity & Efficiency Comparison
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    {safeComparisonRows.map((r, idx) => {
                      const scheme = COLOR_SCHEMES[idx % COLOR_SCHEMES.length]
                      const name = r.member?.name || r.member?.username || 'Member'
                      return (
                        <div key={r.member?.id || r.member?.username || idx} className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full ${scheme.barBg}`} />
                          <span className="text-gray-300 font-semibold">{name}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Grouped Output Bars (Created / Merged / Reviewed) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  {[
                    { label: 'Created MRs', icon: GitPullRequest, key: 'created', accent: 'text-orange-400' },
                    { label: 'Merged MRs', icon: GitMerge, key: 'merged', accent: 'text-emerald-400' },
                    { label: 'Code Reviews', icon: Eye, key: 'reviewed', accent: 'text-blue-400' },
                  ].map(({ label, icon: Icon, key, accent }) => (
                    <div key={key} className="bg-gray-900/60 border border-gray-800/80 p-3 rounded-xl flex flex-col">
                      <div className="flex items-center justify-between text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-3">
                        <span>{label}</span>
                        <Icon className={`w-3.5 h-3.5 ${accent}`} />
                      </div>

                      <div className="flex items-end justify-around h-24 pt-2 px-2 border-b border-gray-800">
                        {safeComparisonRows.map((r, idx) => {
                          const val = (r[key as keyof ComparisonMemberRow] as number) || 0
                          const scheme = COLOR_SCHEMES[idx % COLOR_SCHEMES.length]
                          const heightPct = Math.max((val / globalMaxOutput) * 100, val > 0 ? 12 : 0)
                          const name = r.member?.name || r.member?.username || 'Member'

                          return (
                            <div key={r.member?.id || r.member?.username || idx} className="flex flex-col items-center gap-1.5 flex-1 max-w-[36px]" title={`${name}: ${val}`}>
                              <span className="text-[10px] font-extrabold text-gray-200">{val}</span>
                              <div className="w-full h-16 flex items-end justify-center">
                                <div
                                  style={{ height: `${heightPct}%` }}
                                  className={`w-4 rounded-t-md transition-all duration-500 ${scheme.barBg} shadow-md`}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div className="flex justify-around text-[9px] font-semibold text-gray-500 mt-1.5 truncate">
                        {safeComparisonRows.map((r, idx) => {
                          const name = r.member?.name || r.member?.username || 'User'
                          const firstName = name.split(' ')[0]
                          return (
                            <span key={r.member?.id || r.member?.username || idx} className="truncate max-w-[50px] text-center" title={name}>
                              {firstName}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Horizontal Comparison Bars (Merge Rate & Lead Time) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Merge Success Rate */}
                  <div className="bg-gray-900/60 border border-gray-800/80 p-3 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-800 pb-1.5">
                      <span>Merge Success Rate (%)</span>
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    {safeComparisonRows.map((r, idx) => {
                      const scheme = COLOR_SCHEMES[idx % COLOR_SCHEMES.length]
                      const rate = typeof r.mergeRate === 'number' && !isNaN(r.mergeRate) ? r.mergeRate : 0
                      const name = r.member?.name || r.member?.username || 'Member'

                      return (
                        <div key={r.member?.id || r.member?.username || idx} className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-gray-300">
                            <span className="truncate max-w-[150px]">{name}</span>
                            <span className="font-bold text-emerald-400">
                              {typeof r.mergeRate === 'number' && !isNaN(r.mergeRate) ? `${r.mergeRate}%` : '—'}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-950 rounded-full overflow-hidden border border-gray-800">
                            <div
                              className={`h-full ${scheme.barBg} transition-all duration-500`}
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Avg Lead Time */}
                  <div className="bg-gray-900/60 border border-gray-800/80 p-3 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-800 pb-1.5">
                      <span>Avg Lead Time (Hours)</span>
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    {safeComparisonRows.map((r, idx) => {
                      const scheme = COLOR_SCHEMES[idx % COLOR_SCHEMES.length]
                      const hours = typeof r.averageLeadHours === 'number' && !isNaN(r.averageLeadHours) ? r.averageLeadHours : 0
                      const maxHours = Math.max(...validLeadTimes, 1)
                      const barWidth = hours > 0 ? Math.max((hours / maxHours) * 100, 8) : 0
                      const name = r.member?.name || r.member?.username || 'Member'

                      return (
                        <div key={r.member?.id || r.member?.username || idx} className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-gray-300">
                            <span className="truncate max-w-[150px]">{name}</span>
                            <span className="font-bold text-purple-300">
                              {formatLeadTime(r.averageLeadHours)}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-950 rounded-full overflow-hidden border border-gray-800">
                            <div
                              className={`h-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500`}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Side-by-Side Member Performance Cards Grid */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                  Side-by-Side Performance Cards
                </h3>

                <div className={`grid gap-4 ${
                  safeComparisonRows.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'
                }`}>
                  {safeComparisonRows.map((row, idx) => {
                    const scheme = COLOR_SCHEMES[idx % COLOR_SCHEMES.length]
                    const memberName = row.member?.name || row.member?.username || 'Member'
                    const memberUsername = row.member?.username || ''
                    const isTopCreated = maxCreated > 0 && (row.created || 0) === maxCreated
                    const isTopMerged = maxMerged > 0 && (row.merged || 0) === maxMerged
                    const isTopReviewed = maxReviewed > 0 && (row.reviewed || 0) === maxReviewed
                    const isFastest = minLeadTime !== null && row.averageLeadHours === minLeadTime

                    return (
                      <div
                        key={row.member?.id || memberUsername || idx}
                        className={`rounded-2xl border ${scheme.border} ${scheme.bg} p-4 flex flex-col gap-4 shadow-xl backdrop-blur-sm relative overflow-hidden`}
                      >
                        {/* Column Header */}
                        <div className={`flex items-center gap-3 border-b border-gray-800/80 pb-3 ${scheme.headerBg} -mx-4 -mt-4 p-4 mb-0`}>
                          {row.member?.avatarUrl ? (
                            <img
                              src={row.member.avatarUrl}
                              alt={memberName}
                              className={`w-10 h-10 rounded-full border-2 ${scheme.avatarBorder} object-cover shadow-md`}
                            />
                          ) : (
                            <div className={`w-10 h-10 rounded-full bg-gray-800 border-2 ${scheme.avatarBorder} flex items-center justify-center text-base`}>
                              🦊
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-white truncate">
                              {memberName}
                            </h4>
                            <p className="text-[11px] text-gray-400 truncate">@{memberUsername}</p>
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${scheme.badgeBg}`}>
                            {scheme.tag}
                          </span>
                        </div>

                        {/* Stat KPI Grid */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-gray-950/60 border border-gray-800/60 p-2.5 rounded-xl relative">
                            {isTopCreated && (
                              <span className="absolute -top-1.5 -right-1.5 text-xs" title="Top Created">🥇</span>
                            )}
                            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Created</span>
                            <span className={`mt-1 text-lg font-extrabold block ${scheme.accentText}`}>
                              {row.created || 0}
                            </span>
                          </div>

                          <div className="bg-gray-950/60 border border-gray-800/60 p-2.5 rounded-xl relative">
                            {isTopMerged && (
                              <span className="absolute -top-1.5 -right-1.5 text-xs" title="Top Merged">🥇</span>
                            )}
                            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Merged</span>
                            <span className="mt-1 text-lg font-extrabold text-emerald-400 block">
                              {row.merged || 0}
                            </span>
                          </div>

                          <div className="bg-gray-950/60 border border-gray-800/60 p-2.5 rounded-xl relative">
                            {isTopReviewed && (
                              <span className="absolute -top-1.5 -right-1.5 text-xs" title="Top Reviewer">🥇</span>
                            )}
                            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Reviewed</span>
                            <span className="mt-1 text-lg font-extrabold text-blue-400 block">
                              {row.reviewed || 0}
                            </span>
                          </div>
                        </div>

                        {/* Secondary Metrics */}
                        <div className="space-y-2 bg-gray-950/40 p-3 rounded-xl border border-gray-800/40 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 font-medium">Merge Success Rate</span>
                            <span className="font-bold text-emerald-400">
                              {typeof row.mergeRate === 'number' && !isNaN(row.mergeRate) ? `${row.mergeRate}%` : '—'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 font-medium">Avg Lead Time</span>
                            <span className={`font-bold ${isFastest ? 'text-purple-300 flex items-center gap-1' : 'text-gray-300'}`}>
                              {isFastest && <Clock className="w-3 h-3 text-purple-400" />}
                              {formatLeadTime(row.averageLeadHours)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400 font-medium">Open MRs</span>
                            <span className="font-bold text-amber-300">
                              {row.open || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Detailed Metric Comparison Table */}
              <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-4 shadow-md backdrop-blur-sm">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-3 border-b border-gray-800/80 pb-2">
                  Detailed Metric Matrix
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-500 text-[10px] uppercase font-bold">
                        <th className="py-2.5 px-3">Metric</th>
                        {safeComparisonRows.map((r, idx) => {
                          const scheme = COLOR_SCHEMES[idx % COLOR_SCHEMES.length]
                          const name = r.member?.name || r.member?.username || 'Member'
                          return (
                            <th key={r.member?.id || r.member?.username || idx} className={`py-2.5 px-3 uppercase ${scheme.accentText}`}>
                              {name}
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60 font-medium text-gray-300">
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-gray-400">MRs Created</td>
                        {safeComparisonRows.map((r, idx) => (
                          <td key={r.member?.id || r.member?.username || idx} className="py-2.5 px-3 font-bold text-orange-400">
                            {r.created || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-gray-400">MRs Merged</td>
                        {safeComparisonRows.map((r, idx) => (
                          <td key={r.member?.id || r.member?.username || idx} className="py-2.5 px-3 font-bold text-emerald-400">
                            {r.merged || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-gray-400">Code Reviews</td>
                        {safeComparisonRows.map((r, idx) => (
                          <td key={r.member?.id || r.member?.username || idx} className="py-2.5 px-3 font-bold text-blue-400">
                            {r.reviewed || 0}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-gray-400">Merge Success Rate</td>
                        {safeComparisonRows.map((r, idx) => (
                          <td key={r.member?.id || r.member?.username || idx} className="py-2.5 px-3 font-bold text-emerald-300">
                            {typeof r.mergeRate === 'number' && !isNaN(r.mergeRate) ? `${r.mergeRate}%` : '—'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-gray-400">Average Merge Time</td>
                        {safeComparisonRows.map((r, idx) => (
                          <td key={r.member?.id || r.member?.username || idx} className="py-2.5 px-3 font-bold text-purple-300">
                            {formatLeadTime(r.averageLeadHours)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-semibold text-gray-400">Currently Open MRs</td>
                        {safeComparisonRows.map((r, idx) => (
                          <td key={r.member?.id || r.member?.username || idx} className="py-2.5 px-3 font-bold text-amber-300">
                            {r.open || 0}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Bar */}
        <div className="px-6 py-3 bg-gray-950/80 border-t border-gray-800 flex items-center justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs font-bold uppercase tracking-wide transition-colors shadow-md"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default function MemberComparisonModal(props: MemberComparisonModalProps) {
  return (
    <ModalErrorBoundary onClose={props.onClose}>
      <MemberComparisonModalContent {...props} />
    </ModalErrorBoundary>
  )
}
