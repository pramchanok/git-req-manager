import { useState, useMemo, useEffect } from 'react'
import type { AppState, GitLabGroup, GitLabUser, MergeRequest } from '../../shared/types'
import { SkeletonDevRow } from '../components/SkeletonCard'
import { getTimeframeRange, shiftReferenceDate, isWithin, type Timeframe } from '../utils/timeframe'

interface TeamReportProps {
  appState: AppState
}

const FALLBACK_AVATAR =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%236b7280"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="%236b7280"/></svg>'

export default function TeamReport({ appState }: TeamReportProps) {
  const [search, setSearch] = useState('')
  const [groups, setGroups] = useState<GitLabGroup[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
  const [groupMembers, setGroupMembers] = useState<GitLabUser[]>([])
  const [groupMRs, setGroupMRs] = useState<MergeRequest[]>([])
  const [groupsLoading, setGroupsLoading] = useState(false)
  const [membersLoading, setMembersLoading] = useState(false)
  const [mrsLoading, setMrsLoading] = useState(false)

  // Timeframe and Navigation State
  const [timeframe, setTimeframe] = useState<Timeframe>('weekly')
  const [referenceDate, setReferenceDate] = useState<Date>(new Date())

  // Access Control Checks
  const isAdmin = appState.currentUser?.isAdmin === true
  const isOwner = appState.ownerGroups && appState.ownerGroups.length > 0
  const hasAccess = isAdmin || isOwner

  // 1. Fetch GitLab groups on mount
  useEffect(() => {
    if (!appState.isConfigured || !hasAccess) return
    setGroupsLoading(true)
    window.electronAPI
      .getGitLabGroups()
      .then(setGroups)
      .catch(console.error)
      .finally(() => setGroupsLoading(false))
  }, [appState.isConfigured, hasAccess])

  // Filter groups selectable by the user: Admins see all, Owners see only owned groups
  const selectableGroups = useMemo(() => {
    if (isAdmin) return groups
    return appState.ownerGroups || []
  }, [groups, appState.ownerGroups, isAdmin])

  // Auto-select first group or load saved preference
  useEffect(() => {
    if (selectedGroupId === null && selectableGroups.length > 0) {
      window.electronAPI.getTeamReportGroup().then((savedId) => {
        if (savedId && selectableGroups.some((g) => g.id === savedId)) {
          setSelectedGroupId(savedId)
        } else {
          setSelectedGroupId(selectableGroups[0].id)
        }
      })
    }
  }, [selectableGroups, selectedGroupId])

  // Save selected group preference & reset sub-states
  const handleGroupChange = (groupId: number) => {
    setSelectedGroupId(groupId)
    void window.electronAPI.setTeamReportGroup(groupId)
    setGroupMRs([])
  }

  // 2. Fetch Group Members
  useEffect(() => {
    if (selectedGroupId === null) {
      setGroupMembers([])
      return
    }
    setMembersLoading(true)
    window.electronAPI
      .getGroupMembers(selectedGroupId)
      .then(setGroupMembers)
      .catch(() => setGroupMembers([]))
      .finally(() => setMembersLoading(false))
  }, [selectedGroupId])

  // 3. Compute date range (sinceIso, untilIso & label)
  const { sinceIso, untilIso, label: timeframeLabel } = useMemo(
    () => getTimeframeRange(timeframe, referenceDate),
    [timeframe, referenceDate]
  )

  // 4. Fetch Group MRs based on date range
  useEffect(() => {
    if (selectedGroupId === null || !hasAccess) return
    let active = true
    setMrsLoading(true)

    window.electronAPI
      .getGroupMRsInTimeframe(selectedGroupId, sinceIso)
      .then((mrs) => {
        if (active) {
          setGroupMRs(mrs)
        }
      })
      .catch((err) => {
        console.error(err)
        if (active) setGroupMRs([])
      })
      .finally(() => {
        if (active) setMrsLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedGroupId, sinceIso, untilIso, hasAccess])

  // 5. Navigate timeframe (previous/next)
  const handleNavigateTimeframe = (direction: 'prev' | 'next') => {
    setReferenceDate((current) => shiftReferenceDate(timeframe, current, direction))
  }

  /**
   * 6. จัดกลุ่มยอดกิจกรรมตาม username ในรอบเดียว
   * เดิมวน groupMembers × groupMRs × 3 ครั้ง และคำนวณใหม่ทุกครั้งที่พิมพ์ในช่องค้นหา
   * ตอนนี้ index ครั้งเดียว (ไม่ผูกกับ search) แล้วค่อยกรองด้วย search ทีหลัง
   */
  const { statsByUsername, groupTotals } = useMemo(() => {
    const stats = new Map<string, { created: number; merged: number; reviewed: number }>()
    const bump = (username: string, key: 'created' | 'merged' | 'reviewed') => {
      const entry = stats.get(username) ?? { created: 0, merged: 0, reviewed: 0 }
      entry[key]++
      stats.set(username, entry)
    }

    let created = 0
    let merged = 0

    for (const mr of groupMRs) {
      const isCreated = isWithin(mr.createdAt, sinceIso, untilIso)
      const isMerged = mr.state === 'merged' && isWithin(mr.mergedAt, sinceIso, untilIso)
      const isUpdated = isWithin(mr.updatedAt, sinceIso, untilIso)

      if (isCreated) {
        created++
        bump(mr.author.username, 'created')
      }
      if (isMerged) {
        merged++
        bump(mr.author.username, 'merged')
      }

      if (isUpdated) {
        // reviewer/assignee ที่ไม่ใช่เจ้าของ MR นับเป็นการรีวิว — คนเดียวกันนับครั้งเดียวต่อ MR
        const reviewers = new Set<string>()
        for (const r of mr.reviewers) reviewers.add(r.username)
        for (const a of mr.assignees) reviewers.add(a.username)
        reviewers.delete(mr.author.username)
        for (const username of reviewers) bump(username, 'reviewed')
      }
    }

    return { statsByUsername: stats, groupTotals: { created, merged } }
  }, [groupMRs, sinceIso, untilIso])

  const groupStats = useMemo(() => {
    const activeCount = groupMembers.filter((m) => statsByUsername.has(m.username)).length
    return { ...groupTotals, activeCount }
  }, [groupMembers, statsByUsername, groupTotals])

  // 7. ผูกยอดกิจกรรมเข้ากับรายชื่อสมาชิก แล้วกรอง/เรียง
  const devReportRows = useMemo(() => {
    const query = search.trim().toLowerCase()

    return groupMembers
      .filter(
        (m) =>
          !query ||
          m.name.toLowerCase().includes(query) ||
          m.username.toLowerCase().includes(query)
      )
      .map((member) => {
        const { created, merged, reviewed } = statsByUsername.get(member.username) ?? {
          created: 0,
          merged: 0,
          reviewed: 0,
        }
        return { user: member, created, merged, reviewed, totalActivity: created + merged + reviewed }
      })
      .sort((a, b) => b.totalActivity - a.totalActivity)
  }, [groupMembers, statsByUsername, search])

  const maxActivity = useMemo(() => {
    const max = Math.max(...devReportRows.map((r) => r.totalActivity), 0)
    return max === 0 ? 1 : max
  }, [devReportRows])

  // Open detailed report window
  const openDetailReport = (user: GitLabUser) => {
    if (selectedGroupId === null) return
    window.electronAPI.openReportWindow(
      user.username,
      user.name,
      user.avatarUrl,
      timeframe,
      selectedGroupId
    )
  }

  const openMyReport = () => {
    const user = appState.currentUser
    if (!user) return
    window.electronAPI.openReportWindow(user.username, user.name, user.avatarUrl, timeframe, null, true)
  }

  // ── Access Denied Screen ───────────────────────────────────────────────────
  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 bg-gray-900">
        <div className="w-16 h-16 bg-red-950/40 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-white mb-2">Team report restricted</h2>
        <p className="text-gray-400 text-xs max-w-xs leading-relaxed">
          You can still view your own contribution history. Team members and their activity remain private.
        </p>
        <button
          onClick={openMyReport}
          disabled={!appState.currentUser}
          className="mt-5 inline-flex items-center gap-2 rounded-md border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-xs font-bold text-orange-300 shadow-sm transition-colors hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          View my history ↗
        </button>
      </div>
    )
  }

  if (!appState.isConfigured) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500 text-sm">Configure GitLab settings first.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white page-fade">
      {/* Group Selector & Search */}
      <div className="px-3 py-2 border-b border-gray-950 bg-gray-900/60 flex items-center gap-2 flex-shrink-0">
        <select
          value={selectedGroupId ?? ''}
          onChange={(e) => handleGroupChange(Number(e.target.value))}
          disabled={groupsLoading || selectableGroups.length === 0}
          className="flex-1 bg-gray-800 border border-gray-700 text-white text-xs rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50 cursor-pointer"
        >
          {selectableGroups.length === 0 ? (
            <option value="">No Groups Owned</option>
          ) : (
            selectableGroups.map((g: GitLabGroup) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))
          )}
        </select>
        <input
          type="text"
          placeholder="Search dev…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-28 bg-gray-800 border border-gray-700 text-white text-xs rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-orange-500 placeholder-gray-500"
        />
      </div>

      {/* Timeframe Controller Toolbar */}
      <div className="px-3 py-2 bg-gray-950/40 border-b border-gray-950 flex flex-col gap-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex bg-gray-800 rounded p-0.5 border border-gray-700">
            {(['daily', 'weekly', 'monthly'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTimeframe(t)
                  setReferenceDate(new Date())
                }}
                className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                  timeframe === t
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {t === 'daily' ? 'Day' : t === 'weekly' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleNavigateTimeframe('prev')}
              className="w-6 h-6 flex items-center justify-center bg-gray-800 border border-gray-700 hover:bg-gray-700 rounded text-xs transition-colors"
            >
              ◀
            </button>
            <button
              onClick={() => setReferenceDate(new Date())}
              className="px-2 py-1 text-[10px] font-semibold bg-gray-800 border border-gray-700 hover:bg-gray-700 rounded transition-colors"
            >
              {timeframe === 'daily' ? 'Today' : timeframe === 'weekly' ? 'This Week' : 'This Month'}
            </button>
            <button
              onClick={() => handleNavigateTimeframe('next')}
              className="w-6 h-6 flex items-center justify-center bg-gray-800 border border-gray-700 hover:bg-gray-700 rounded text-xs transition-colors"
            >
              ▶
            </button>
          </div>
        </div>

        <div className="text-center">
          <span className="text-xs font-semibold text-orange-400 tracking-wide">
            {timeframeLabel}
          </span>
        </div>
      </div>

      {/* Group Overview Stats Card Grid */}
      {selectedGroupId !== null && (
        <div className="grid grid-cols-3 gap-2 px-3 py-2 bg-gray-950/20 border-b border-gray-950 flex-shrink-0">
          <div className="bg-gray-800/20 border border-gray-800/60 rounded p-2 text-center backdrop-blur-sm">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Created</p>
            <p className="text-sm font-bold text-orange-400 mt-0.5">{groupStats.created}</p>
          </div>
          <div className="bg-gray-800/20 border border-gray-800/60 rounded p-2 text-center backdrop-blur-sm">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Merged</p>
            <p className="text-sm font-bold text-green-400 mt-0.5">{groupStats.merged}</p>
          </div>
          <div className="bg-gray-800/20 border border-gray-800/60 rounded p-2 text-center backdrop-blur-sm">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Active Devs</p>
            <p className="text-sm font-bold text-blue-400 mt-0.5">{groupStats.activeCount}</p>
          </div>
        </div>
      )}

      {/* Dev performance list */}
      <div className="flex-1 overflow-y-auto scroll-hide">
        {membersLoading || mrsLoading ? (
          <div className="flex flex-col">
            {[...Array(5)].map((_, i) => (
              <SkeletonDevRow key={i} />
            ))}
          </div>
        ) : devReportRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
            <svg className="w-10 h-10 text-gray-700 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <p className="text-gray-400 text-sm">
              {selectedGroupId === null
                ? 'Please select a group first.'
                : 'No contributions recorded in this timeframe.'}
            </p>
          </div>
        ) : (
          devReportRows.map((row) => {
            const { user, created, merged, reviewed, totalActivity } = row
            const activityPercent = (totalActivity / maxActivity) * 100

            return (
              <div
                key={user.username}
                onClick={() => openDetailReport(user)}
                className="flex items-center gap-3 px-3 py-3 border-b border-gray-800 hover:bg-gray-800/60 transition-colors cursor-pointer"
                title="คลิกเพื่อดูรายงานละเอียดแยกหน้าต่างใหญ่"
              >
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="w-8 h-8 rounded-full flex-shrink-0 border border-gray-700"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).src = FALLBACK_AVATAR
                  }}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white font-bold truncate">{user.name}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openDetailReport(user)
                      }}
                      className="text-[10px] text-orange-400 hover:text-orange-300 font-bold tracking-wide uppercase transition-colors"
                    >
                      Report ↗
                    </button>
                  </div>

                  <div className="flex gap-2.5 text-[9px] text-gray-400 font-medium mt-0.5">
                    <span className={created > 0 ? 'text-orange-400' : ''}>✍️ {created} created</span>
                    <span className={merged > 0 ? 'text-green-400' : ''}>🏆 {merged} merged</span>
                    <span className={reviewed > 0 ? 'text-blue-400' : ''}>👁️ {reviewed} reviewed</span>
                  </div>

                  {/* Sleek Gradient Activity Meter */}
                  <div className="w-full bg-gray-800/80 rounded-full h-1 mt-1.5 overflow-hidden">
                    <div
                      style={{ width: `${activityPercent}%` }}
                      className="bg-gradient-to-r from-orange-500 to-green-500 h-full rounded-full transition-all duration-300"
                    ></div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
