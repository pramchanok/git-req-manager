import React, { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  GitPullRequest,
  GitMerge,
  Eye,
  ExternalLink,
  Trophy,
  Award,
  BarChart3,
  ArrowLeft,
  X,
  FolderGit2,
  PieChart,
} from 'lucide-react'
import type { GitLabGroup, GitLabUser, MergeRequest } from '../../shared/types'
import { getTimeframeRange, isWithin, shiftReferenceDate, type Timeframe } from '../utils/timeframe'
import MemberComparisonModal, { type ComparisonMemberRow } from '../components/report/MemberComparisonModal'

function riskReason(mr: MergeRequest): string {
  if (mr.hasConflicts) return 'Merge conflict'
  if (mr.pipelineStatus === 'failed') return 'Pipeline failed'
  return 'Waiting over 7 days'
}

export default function LeadOverview() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const groupId = Number(params.get('groupId'))
  const initialTimeframe = params.get('timeframe') as Timeframe
  
  const [timeframe, setTimeframe] = useState<Timeframe>(
    ['daily', 'weekly', 'monthly', 'yearly'].includes(initialTimeframe) ? initialTimeframe : 'weekly'
  )
  const [referenceDate, setReferenceDate] = useState<Date>(new Date())

  const [members, setMembers] = useState<GitLabUser[]>([])
  const [mrs, setMrs] = useState<MergeRequest[]>([])
  const [groups, setGroups] = useState<GitLabGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([])
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false)

  const { sinceIso, untilIso, label } = useMemo(
    () => getTimeframeRange(timeframe, referenceDate),
    [timeframe, referenceDate]
  )

  useEffect(() => {
    if (!Number.isFinite(groupId) || groupId <= 0) {
      setError('A team group is required to open this overview.')
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    Promise.all([
      window.electronAPI.getGroupMembers(groupId),
      window.electronAPI.getGroupMRsInTimeframe(groupId, sinceIso),
      window.electronAPI.getGitLabGroups(),
    ])
      .then(([nextMembers, nextMrs, nextGroups]) => {
        if (!active) return
        setMembers(nextMembers || [])
        setMrs(nextMrs || [])
        setGroups(nextGroups || [])
      })
      .catch(() => {
        if (active) setError('Unable to load the team overview from GitLab.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [groupId, sinceIso])

  const groupName = groups.find((group) => group.id === groupId)?.name ?? `Group #${groupId}`

  // Calculate detailed member performance stats
  const memberStats = useMemo<ComparisonMemberRow[]>(() => {
    return members.map((member) => {
      const authored = mrs.filter((mr) => mr.author.username === member.username && isWithin(mr.createdAt, sinceIso, untilIso))
      const mergedMRs = mrs.filter((mr) => mr.author.username === member.username && mr.state === 'merged' && isWithin(mr.mergedAt, sinceIso, untilIso))
      const reviewed = mrs.filter((mr) => mr.author.username !== member.username && isWithin(mr.updatedAt, sinceIso, untilIso) && (mr.reviewers.some((r) => r.username === member.username) || mr.assignees.some((a) => a.username === member.username))).length
      const open = mrs.filter((mr) => mr.author.username === member.username && mr.state === 'opened').length

      const created = authored.length
      const merged = mergedMRs.length

      const leadTimes = mergedMRs
        .map((m) => (m.mergedAt ? (new Date(m.mergedAt).getTime() - new Date(m.createdAt).getTime()) / (1000 * 60 * 60) : null))
        .filter((h): h is number => h !== null && !isNaN(h) && h >= 0)
      const averageLeadHours = leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : null

      const totalDecided = authored.filter((m) => m.state === 'merged' || m.state === 'closed').length
      const mergeRate = totalDecided > 0 ? Math.round((merged / totalDecided) * 100) : null

      return {
        member,
        created,
        merged,
        reviewed,
        open,
        averageLeadHours,
        mergeRate,
        total: created + merged + reviewed,
      }
    }).sort((a, b) => b.total - a.total)
  }, [members, mrs, sinceIso, untilIso])

  const attention = useMemo(
    () =>
      mrs
        .filter((mr) => {
          if (mr.state !== 'opened') return false
          const waitingOverSevenDays = Date.now() - new Date(mr.createdAt).getTime() > 7 * 24 * 60 * 60 * 1000
          return mr.hasConflicts || mr.pipelineStatus === 'failed' || waitingOverSevenDays
        })
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [mrs]
  )

  const totals = useMemo(() => {
    const created = memberStats.reduce((sum, row) => sum + row.created, 0)
    const merged = memberStats.reduce((sum, row) => sum + row.merged, 0)
    const reviewed = memberStats.reduce((sum, row) => sum + row.reviewed, 0)
    const open = memberStats.reduce((sum, row) => sum + row.open, 0)
    const totalOutput = created + merged + reviewed
    return { created, merged, reviewed, open, totalOutput }
  }, [memberStats])

  // Top Active Projects Breakdown
  const topProjects = useMemo(() => {
    const counts = new Map<string, number>()
    mrs.forEach((mr) => {
      const proj = mr.projectName || mr.projectNamespace || 'Unknown Project'
      counts.set(proj, (counts.get(proj) || 0) + 1)
    })
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
  }, [mrs])

  const comparisonRows = useMemo(
    () =>
      memberStats
        .filter((row) => selectedUsernames.includes(row.member.username))
        .sort((a, b) => selectedUsernames.indexOf(a.member.username) - selectedUsernames.indexOf(b.member.username)),
    [memberStats, selectedUsernames]
  )

  const toggleComparisonUser = (username: string) => {
    setSelectedUsernames((current) =>
      current.includes(username)
        ? current.filter((item) => item !== username)
        : current.length >= 3
        ? current
        : [...current, username]
    )
  }

  const handleNavigateTimeframe = (direction: 'prev' | 'next') => {
    setReferenceDate((current) => shiftReferenceDate(timeframe, current, direction))
  }

  // Top achievements across team
  const topCreated = useMemo(() => Math.max(...memberStats.map((r) => r.created), 0), [memberStats])
  const topMerged = useMemo(() => Math.max(...memberStats.map((r) => r.merged), 0), [memberStats])
  const topReviewed = useMemo(() => Math.max(...memberStats.map((r) => r.reviewed), 0), [memberStats])

  const topCreatedMember = memberStats.find((r) => topCreated > 0 && r.created === topCreated)
  const topMergedMember = memberStats.find((r) => topMerged > 0 && r.merged === topMerged)
  const topReviewedMember = memberStats.find((r) => topReviewed > 0 && r.reviewed === topReviewed)

  if (loading) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-gray-950 text-gray-400">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
        <span className="text-xs font-semibold text-gray-300">Loading team overview…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-950 text-center text-gray-300 p-6">
        <AlertTriangle className="w-10 h-10 text-rose-400" />
        <p className="text-sm font-semibold text-gray-200">{error}</p>
        <button
          onClick={() => window.close()}
          className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-xs font-bold text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
        >
          Close Window
        </button>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 sm:p-8 flex flex-col gap-6 select-text">
      {/* Executive Header Toolbar */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800/80 pb-5">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.close()}
            className="w-9 h-9 rounded-xl bg-gray-900 border border-gray-800 hover:bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center transition-colors shadow-sm"
            title="Back to team view"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-400" />
              <h1 className="text-xl font-extrabold text-white tracking-wide">
                Team Lead Overview
              </h1>
              <span className="bg-orange-500/10 border border-orange-500/30 text-orange-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {groupName}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Comprehensive team performance report & workload health
            </p>
          </div>
        </div>

        {/* Center: Date Range Badge */}
        <div className="hidden md:flex items-center gap-2 bg-gray-900/80 border border-gray-800 px-4 py-1.5 rounded-full shadow-inner">
          <Calendar className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-xs font-semibold text-gray-200">{label}</span>
        </div>

        {/* Right: Timeframe & Status Controls */}
        <div className="flex items-center gap-3">
          {/* Timeframe Mode Selector Pills */}
          <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl p-0.5 shadow-inner">
            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTimeframe(t)
                  setReferenceDate(new Date())
                }}
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
              onClick={() => handleNavigateTimeframe('prev')}
              className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              title="Previous period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleNavigateTimeframe('next')}
              className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
              title="Next period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Team Health Badge */}
          <div
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-sm ${
              attention.length > 0
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {attention.length > 0 ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>{attention.length} Needs Attention</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Team is On Track</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Executive KPI Cards Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="rounded-2xl border border-gray-800/80 bg-gray-900/60 p-4 flex flex-col justify-between shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">MRs Created</span>
            <GitPullRequest className="w-4 h-4 text-orange-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-orange-400 leading-none">{totals.created}</span>
            <span className="text-[10px] text-gray-500 block mt-1">Across {members.length} members</span>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800/80 bg-gray-900/60 p-4 flex flex-col justify-between shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">MRs Merged</span>
            <GitMerge className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-emerald-400 leading-none">{totals.merged}</span>
            <span className="text-[10px] text-gray-500 block mt-1">Successfully merged</span>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800/80 bg-gray-900/60 p-4 flex flex-col justify-between shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Code Reviews</span>
            <Eye className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-blue-400 leading-none">{totals.reviewed}</span>
            <span className="text-[10px] text-gray-500 block mt-1">Peer reviews done</span>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800/80 bg-gray-900/60 p-4 flex flex-col justify-between shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Open Now</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-amber-400 leading-none">{totals.open}</span>
            <span className="text-[10px] text-gray-500 block mt-1">Active in progress</span>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 flex flex-col justify-between shadow-lg backdrop-blur-sm transition-colors ${
          attention.length > 0 ? 'border-amber-500/40 bg-amber-500/10' : 'border-gray-800/80 bg-gray-900/60'
        }`}>
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Attention</span>
            <AlertTriangle className={`w-4 h-4 ${attention.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-black leading-none ${attention.length > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>
              {attention.length}
            </span>
            <span className="text-[10px] text-gray-400 block mt-1">
              {attention.length > 0 ? 'Blocked or ageing MRs' : 'All clear 🟢'}
            </span>
          </div>
        </div>
      </section>

      {/* Balanced 2-Column Dashboard Content */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Attention MRs & Team Member Roster */}
        <div className="lg:col-span-2 space-y-6">
          {/* Work Needing Attention Section */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-gray-800/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">Work Needing Attention</h2>
                  <p className="text-[10px] text-gray-400">Merge conflicts, failed pipelines, or open over 7 days</p>
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                attention.length > 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {attention.length} items
              </span>
            </div>

            {attention.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center gap-2 border border-dashed border-gray-800/80 rounded-xl bg-gray-950/20">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                <p className="text-xs font-bold text-emerald-300">All Systems Normal</p>
                <p className="text-[10px] text-gray-500">No blocked, failing, or ageing merge requests across the team.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {attention.map((mr) => (
                  <div
                    key={mr.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-gray-800/80 bg-gray-950/60 p-3 hover:border-amber-500/40 hover:bg-gray-900 transition-all shadow-sm group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          !{mr.iid} · {riskReason(mr)}
                        </span>
                        <span className="text-[10px] text-gray-400 font-semibold truncate">
                          {mr.projectName || mr.projectNamespace}
                        </span>
                      </div>
                      <h3 className="text-xs font-semibold text-gray-100 truncate group-hover:text-amber-300 transition-colors">
                        {mr.title}
                      </h3>
                      <p className="text-[10px] text-gray-500 mt-0.5">Author: {mr.author.name}</p>
                    </div>

                    <button
                      onClick={() => window.electronAPI.openMRWindow(mr.projectId, mr.iid)}
                      className="flex items-center gap-1 text-[10px] font-bold text-orange-400 hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 px-3 py-1.5 rounded-lg border border-orange-500/20 transition-all flex-shrink-0"
                    >
                      <span>Open MR</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Team Member Performance Roster (Restricted width to fit perfectly without empty voids) */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-gray-800/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-400" />
                <div>
                  <h2 className="text-sm font-bold text-white">Team Member Performance Roster</h2>
                  <p className="text-[10px] text-gray-400">Click any member to open their detailed report window</p>
                </div>
              </div>
              <span className="text-[10px] text-gray-400 font-semibold bg-gray-800 border border-gray-700 px-2.5 py-0.5 rounded-full">
                {memberStats.length} Members
              </span>
            </div>

            <div className="space-y-2.5">
              {memberStats.map((row) => {
                const maxTotal = Math.max(...memberStats.map((r) => r.total), 1)
                const relativePct = Math.max((row.total / maxTotal) * 100, 5)

                return (
                  <div
                    key={row.member.id || row.member.username}
                    onClick={() => window.electronAPI.openReportWindow(row.member.username, row.member.name, row.member.avatarUrl, timeframe, groupId)}
                    className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 p-3 rounded-xl border border-gray-800/80 bg-gray-950/40 hover:bg-gray-900 hover:border-gray-700 transition-all cursor-pointer shadow-sm group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {row.member.avatarUrl ? (
                        <img
                          src={row.member.avatarUrl}
                          alt={row.member.name}
                          className="w-8 h-8 rounded-full object-cover border border-gray-700"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs">
                          🦊
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-bold text-gray-200 group-hover:text-orange-400 transition-colors truncate">
                            {row.member.name}
                          </h3>
                          <span className="text-[10px] text-gray-500 truncate">@{row.member.username}</span>
                        </div>
                        {/* Relative Activity Bar */}
                        <div className="w-full max-w-[180px] h-1.5 bg-gray-950 rounded-full overflow-hidden border border-gray-800 mt-1">
                          <div
                            className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-500"
                            style={{ width: `${relativePct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Stat Badges */}
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 px-2 py-0.5 rounded-lg" title="Created MRs">
                        <GitPullRequest className="w-3 h-3" />
                        <span>{row.created}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-lg" title="Merged MRs">
                        <GitMerge className="w-3 h-3" />
                        <span>{row.merged}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded-lg" title="Code Reviews">
                        <Eye className="w-3 h-3" />
                        <span>{row.reviewed}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2 py-0.5 rounded-lg" title="Open MRs">
                        <Clock className="w-3 h-3" />
                        <span>{row.open}</span>
                      </div>

                      <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Compare, Highlights, Projects & Workload Share */}
        <div className="space-y-6">
          {/* Member Comparison Launch & Period Highlights Card */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 shadow-xl backdrop-blur-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-gray-800/80 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-bold text-white">Period Highlights</h2>
                </div>
                <button
                  onClick={() => setIsComparisonModalOpen(true)}
                  className="flex items-center gap-1 text-[10px] font-bold text-orange-400 hover:text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 px-2.5 py-1 rounded-lg border border-orange-500/20 transition-all"
                >
                  <BarChart3 className="w-3 h-3" />
                  <span>Compare</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {topCreatedMember && (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-950/40 border border-gray-800/60">
                    <Award className="w-4 h-4 text-orange-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Top Creator</span>
                      <h3 className="text-xs font-bold text-orange-300 truncate">{topCreatedMember.member.name}</h3>
                    </div>
                    <span className="text-xs font-black text-orange-400">{topCreatedMember.created} MRs</span>
                  </div>
                )}

                {topMergedMember && (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-950/40 border border-gray-800/60">
                    <GitMerge className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Top Merged</span>
                      <h3 className="text-xs font-bold text-emerald-300 truncate">{topMergedMember.member.name}</h3>
                    </div>
                    <span className="text-xs font-black text-emerald-400">{topMergedMember.merged} MRs</span>
                  </div>
                )}

                {topReviewedMember && (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-950/40 border border-gray-800/60">
                    <Eye className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Top Reviewer</span>
                      <h3 className="text-xs font-bold text-blue-300 truncate">{topReviewedMember.member.name}</h3>
                    </div>
                    <span className="text-xs font-black text-blue-400">{topReviewedMember.reviewed} Reviews</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsComparisonModalOpen(true)}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold text-xs py-2.5 px-3 rounded-xl shadow-lg transition-all"
            >
              <Users className="w-4 h-4" />
              <span>Launch Member Comparison</span>
            </button>
          </div>

          {/* Top Active Projects Breakdown */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-gray-800/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-bold text-white">Top Active Projects</h2>
              </div>
              <span className="text-[10px] text-gray-400 font-semibold">{topProjects.length} Projects</span>
            </div>

            {topProjects.length === 0 ? (
              <div className="text-[10px] text-gray-500 text-center py-4">No project activity found</div>
            ) : (
              <div className="space-y-2.5">
                {topProjects.map((p) => {
                  const maxCount = Math.max(...topProjects.map((x) => x.count), 1)
                  const barPct = Math.max((p.count / maxCount) * 100, 10)

                  return (
                    <div key={p.name} className="p-2.5 rounded-xl bg-gray-950/40 border border-gray-800/60 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-gray-200 truncate max-w-[160px]">{p.name}</span>
                        <span className="text-blue-400 font-bold">{p.count} MRs</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-950 rounded-full overflow-hidden border border-gray-800">
                        <div
                          className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Team Workload Share & Output Distribution */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 shadow-xl backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-gray-800/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-white">สัดส่วนผลงานในทีม (Team Workload Share)</h2>
              </div>
              <span className="text-[10px] text-gray-400 font-semibold">รวม {totals.totalOutput} กิจกรรม</span>
            </div>

            <div className="space-y-3">
              {memberStats.map((r) => {
                const sharePct = totals.totalOutput > 0 ? Math.round((r.total / totals.totalOutput) * 100) : 0
                return (
                  <div key={r.member.id || r.member.username} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-gray-300 truncate max-w-[150px]">{r.member.name}</span>
                      <span className="text-emerald-400 font-bold">{sharePct}% ({r.total} กิจกรรม)</span>
                    </div>
                    <div className="w-full h-2 bg-gray-950 rounded-full overflow-hidden border border-gray-800">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                        style={{ width: `${sharePct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Embedded Executive Comparison Modal */}
      <MemberComparisonModal
        isOpen={isComparisonModalOpen}
        onClose={() => setIsComparisonModalOpen(false)}
        members={members}
        selectedUsername={selectedUsernames[0] || ''}
        comparisonUsernames={selectedUsernames}
        toggleComparisonUser={toggleComparisonUser}
        comparisonRows={comparisonRows}
        timeframe={timeframe}
        setTimeframe={(t) => {
          setTimeframe(t)
          setReferenceDate(new Date())
        }}
        timeframeLabel={label}
        onNavigateTimeframe={handleNavigateTimeframe}
      />
    </main>
  )
}
