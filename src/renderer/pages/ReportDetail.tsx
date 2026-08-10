import { useState, useEffect, useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { 
  FileText, 
  FileSpreadsheet, 
  FileDown, 
  Calendar, 
  Users, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  GitPullRequest, 
  GitMerge, 
  Eye, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  LayoutDashboard, 
  FolderGit2,
  Activity
} from 'lucide-react'
import type { MergeRequest, GitLabGroup, GitLabUser } from '../../shared/types'
import ActivityBarChart from '../components/report/ActivityBarChart'
import ContributionRadar from '../components/report/ContributionRadar'
import ReportMRCard from '../components/report/ReportMRCard'
import MemberComparisonModal from '../components/report/MemberComparisonModal'
import { buildReportMarkdown, buildReportCSV } from '../utils/reportBuilder'
import { getTimeframeRange, shiftReferenceDate, isWithin, type Timeframe } from '../utils/timeframe'
import { formatDate } from '../utils/dateFormat'

function formatLeadTime(hours: number | null): string {
  if (hours === null) return '—'
  if (hours < 24) return `${Math.round(hours)}h`
  return `${(hours / 24).toFixed(hours < 240 ? 1 : 0)}d`
}

// ── Main Page Component ──────────────────────────────────────────────────────
export default function ReportDetail() {
  const [loading, setLoading] = useState(true)
  const [groupMRs, setGroupMRs] = useState<MergeRequest[]>([])
  const [groups, setGroups] = useState<GitLabGroup[]>([])
  const [groupMembers, setGroupMembers] = useState<GitLabUser[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState<string | null>(null)
  
  // UI States
  const [activeViewTab, setActiveViewTab] = useState<'dashboard' | 'markdown'>('dashboard')
  const [activeMRTab, setActiveMRTab] = useState<'authored' | 'merged' | 'reviewed' | 'attention'>('attention')
  const [mrSearchQuery, setMRSearchQuery] = useState('')
  const [isComparisonPanelOpen, setIsComparisonPanelOpen] = useState(false)

  // Timeframe and Reference Date State (Making report detail dynamic & interactive)
  const [timeframe, setTimeframe] = useState<Timeframe>(() => {
    const params = new URLSearchParams(window.location.search)
    return (params.get('timeframe') || 'weekly') as Timeframe
  })
  const [referenceDate, setReferenceDate] = useState<Date>(new Date())

  // Parse remaining query params
  const { username: initialUsername, name: initialName, avatarUrl: initialAvatarUrl, groupId, personal } = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      username: params.get('username') || '',
      name: params.get('name') || '',
      avatarUrl: params.get('avatarUrl') || '',
      groupId: params.get('groupId') ? Number(params.get('groupId')) : null,
      personal: params.get('personal') === 'true',
    }
  }, [])

  const initialUser = useMemo<GitLabUser>(() => ({
    id: 0,
    username: initialUsername,
    name: initialName,
    avatarUrl: initialAvatarUrl,
    webUrl: '',
  }), [initialUsername, initialName, initialAvatarUrl])
  const [selectedUsername, setSelectedUsername] = useState(initialUsername)
  const [comparisonUsernames, setComparisonUsernames] = useState<string[]>([initialUsername])
  const selectedUser = useMemo(
    () => groupMembers.find((member) => member.username === selectedUsername) ?? initialUser,
    [groupMembers, initialUser, selectedUsername]
  )
  const { username, name, avatarUrl } = selectedUser
  const updateSelectedUser = (nextUsername: string) => {
    setSelectedUsername(nextUsername)
    setComparisonUsernames((current) => current.includes(nextUsername) ? current : [nextUsername, ...current].slice(0, 3))
  }
  const toggleComparisonUser = (nextUsername: string) => {
    setComparisonUsernames((current) => {
      if (current.includes(nextUsername)) return current.length === 1 ? current : current.filter((username) => username !== nextUsername)
      return current.length === 3 ? current : [...current, nextUsername]
    })
  }

  // 1. Load groups to find group name
  useEffect(() => {
    window.electronAPI.getGitLabGroups().then(setGroups).catch(console.error)
  }, [])

  // Group reports already have a member API; load it here so a manager can switch
  // profiles without needing to return to the team list and open another window.
  useEffect(() => {
    if (!groupId || personal) {
      setGroupMembers([])
      return
    }

    let active = true
    setMembersLoading(true)
    window.electronAPI
      .getGroupMembers(groupId)
      .then((members) => {
        if (!active) return
        setGroupMembers(members)
        if (!members.some((member) => member.username === selectedUsername) && members[0]) {
          updateSelectedUser(members[0].username)
        }
      })
      .catch(() => {
        if (active) setGroupMembers([])
      })
      .finally(() => {
        if (active) setMembersLoading(false)
      })

    return () => { active = false }
  }, [groupId, personal])

  const selectedGroupName = useMemo(() => {
    if (personal) return 'My accessible projects'
    const g = groups.find((group) => group.id === groupId)
    return g ? g.name : `Group #${groupId}`
  }, [groups, groupId, personal])

  // 2. Calculate date range dynamically
  const { sinceIso, untilIso, timeframeLabel } = useMemo(() => {
    const range = getTimeframeRange(timeframe, referenceDate)
    const prefix =
      timeframe === 'daily'
        ? 'Daily Report'
        : timeframe === 'weekly'
        ? 'Weekly Report'
        : timeframe === 'monthly'
        ? 'Monthly Report'
        : 'Yearly Report'
    return {
      sinceIso: range.sinceIso,
      untilIso: range.untilIso,
      timeframeLabel: timeframe === 'daily' ? `${prefix} (${range.label})` : `${prefix}: ${range.label}`,
    }
  }, [timeframe, referenceDate])

  // Calculate chart days and start timestamp based on referenceDate and timeframe
  const chartInfo = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const result = []
    let endDate = new Date(referenceDate)

    if (timeframe === 'weekly') {
      // For weekly, the chart is always Monday to Sunday of the selected week
      const day = endDate.getDay()
      const diff = endDate.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(endDate)
      monday.setDate(diff)
      monday.setHours(0, 0, 0, 0)

      for (let i = 0; i < 7; i++) {
        const d2 = new Date(monday)
        d2.setDate(monday.getDate() + i)
        result.push({
          timestamp: d2.getTime(),
          dayLabel: days[d2.getDay()],
          dateLabel: formatDate(d2)
        })
      }
    } else {
      // For daily and monthly, the chart shows the 7 days ending at referenceDate
      const refMidnight = new Date(referenceDate)
      refMidnight.setHours(0, 0, 0, 0)

      for (let i = 6; i >= 0; i--) {
        const d2 = new Date(refMidnight)
        d2.setDate(refMidnight.getDate() - i)
        result.push({
          timestamp: d2.getTime(),
          dayLabel: days[d2.getDay()],
          dateLabel: formatDate(d2)
        })
      }
    }

    const chartSinceIso = new Date(result[0].timestamp).toISOString()
    return {
      chartDays: result,
      chartSinceIso
    }
  }, [timeframe, referenceDate])

  // ดึงข้อมูลให้ครอบทั้งช่วงรายงานและช่วงของกราฟ (กราฟอาจกินวันนอกช่วงรายงาน)
  const { fetchSinceIso, fetchUntilIso } = useMemo(() => {
    const chartDays = chartInfo.chartDays
    const chartStart = chartDays[0].timestamp
    // ปลายวันของแท่งสุดท้ายในกราฟ
    const chartEnd = chartDays[chartDays.length - 1].timestamp + 24 * 60 * 60 * 1000 - 1

    return {
      fetchSinceIso: new Date(Math.min(new Date(sinceIso).getTime(), chartStart)).toISOString(),
      fetchUntilIso: new Date(Math.max(new Date(untilIso).getTime(), chartEnd)).toISOString(),
    }
  }, [sinceIso, untilIso, chartInfo])

  // 3. Fetch Group MRs in this timeframe
  useEffect(() => {
    if (!groupId && !personal) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    const fetchMRs = personal
      ? window.electronAPI.getMyMRsInTimeframe(fetchSinceIso)
      : window.electronAPI.getGroupMRsInTimeframe(groupId!, fetchSinceIso)

    fetchMRs
      .then((mrs) => {
        if (active) {
          setGroupMRs(mrs)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          console.error(err)
          setError('Failed to load merge request data from GitLab.')
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [groupId, personal, fetchSinceIso, fetchUntilIso])

  // 4. Filter and Aggregate data for target developer
  const developerData = useMemo(() => {
    const authored: MergeRequest[] = []
    const merged: MergeRequest[] = []
    const reviewed: MergeRequest[] = []

    for (const mr of groupMRs) {
      const isAuthor = mr.author.username === username

      if (isAuthor && isWithin(mr.createdAt, sinceIso, untilIso)) authored.push(mr)
      if (isAuthor && mr.state === 'merged' && isWithin(mr.mergedAt, sinceIso, untilIso)) merged.push(mr)

      if (
        !isAuthor &&
        isWithin(mr.updatedAt, sinceIso, untilIso) &&
        (mr.reviewers.some((r) => r.username === username) ||
          mr.assignees.some((a) => a.username === username))
      ) {
        reviewed.push(mr)
      }
    }

    return { authored, merged, reviewed }
  }, [groupMRs, username, sinceIso, untilIso])

  const workHealth = useMemo(() => {
    const authoredByUser = groupMRs.filter((mr) => mr.author.username === username)
    const openMRs = authoredByUser.filter((mr) => mr.state === 'opened')
    const waitingOverSevenDays = openMRs.filter(
      (mr) => Date.now() - new Date(mr.createdAt).getTime() > 7 * 24 * 60 * 60 * 1000
    )
    const completedLeadTimes = developerData.merged
      .map((mr) => mr.mergedAt ? (new Date(mr.mergedAt).getTime() - new Date(mr.createdAt).getTime()) / 3_600_000 : null)
      .filter((hours): hours is number => hours !== null && hours >= 0)
    const averageLeadHours = completedLeadTimes.length === 0
      ? null
      : completedLeadTimes.reduce((sum, hours) => sum + hours, 0) / completedLeadTimes.length
    const awaitingReviewOrApproval = openMRs.filter((mr) => mr.reviewers.length > 0 || mr.approvalsLeft > 0).length

    return {
      open: openMRs.length,
      blocked: openMRs.filter((mr) => mr.hasConflicts || mr.pipelineStatus === 'failed').length,
      waitingOverSevenDays: waitingOverSevenDays.length,
      mergeRate: developerData.authored.length === 0
        ? null
        : Math.round((developerData.merged.length / developerData.authored.length) * 100),
      averageLeadHours,
      awaitingReviewOrApproval,
    }
  }, [groupMRs, username, developerData])

  const attentionMRs = useMemo(() => groupMRs.filter((mr) => {
    if (mr.author.username !== username || mr.state !== 'opened') return false
    const waitingOverSevenDays = Date.now() - new Date(mr.createdAt).getTime() > 7 * 24 * 60 * 60 * 1000
    return mr.hasConflicts || mr.pipelineStatus === 'failed' || waitingOverSevenDays || mr.reviewers.length > 0 || mr.approvalsLeft > 0
  }), [groupMRs, username])

  const topProjects = useMemo(() => {
    const counts = new Map<string, number>()
    const uniqueMRs = new Map<number, MergeRequest>()
    for (const mr of [...developerData.authored, ...developerData.merged, ...developerData.reviewed]) uniqueMRs.set(mr.id, mr)
    for (const mr of uniqueMRs.values()) {
      const project = mr.projectName || mr.projectNamespace || 'Unknown project'
      counts.set(project, (counts.get(project) ?? 0) + 1)
    }
    return Array.from(counts, ([project, count]) => ({ project, count })).sort((a, b) => b.count - a.count).slice(0, 4)
  }, [developerData])

  const teamSnapshot = useMemo(() => {
    if (personal) return []
    return groupMembers.map((member) => {
      const authored = groupMRs.filter((mr) => mr.author.username === member.username && isWithin(mr.createdAt, sinceIso, untilIso))
      const mergedMRs = groupMRs.filter((mr) => mr.author.username === member.username && mr.state === 'merged' && isWithin(mr.mergedAt, sinceIso, untilIso))
      const reviewed = groupMRs.filter((mr) => mr.author.username !== member.username && isWithin(mr.updatedAt, sinceIso, untilIso) && (mr.reviewers.some((reviewer) => reviewer.username === member.username) || mr.assignees.some((assignee) => assignee.username === member.username))).length
      const open = groupMRs.filter((mr) => mr.author.username === member.username && mr.state === 'opened').length

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
        total: created + merged + reviewed 
      }
    }).sort((a, b) => b.total - a.total)
  }, [personal, groupMembers, groupMRs, sinceIso, untilIso])
  const comparisonRows = useMemo(
    () => teamSnapshot.filter(({ member }) => comparisonUsernames.includes(member.username)).sort((a, b) => comparisonUsernames.indexOf(a.member.username) - comparisonUsernames.indexOf(b.member.username)),
    [teamSnapshot, comparisonUsernames]
  )

  // Compute 7-day activity timeline based on local midnight timestamps
  const dailyActivity = useMemo(() => {
    const activityMap = new Map<number, number>()
    
    chartInfo.chartDays.forEach((day) => {
      activityMap.set(day.timestamp, 0)
    })

    const allDeveloperMRs = groupMRs.filter((mr) => {
      const isAuthor = mr.author.username === username
      const isReviewer = mr.reviewers.some((r) => r.username === username) ||
                         mr.assignees.some((a) => a.username === username)
      return isAuthor || isReviewer
    })

    const getMidnightTimestamp = (d: Date) => {
      const dateCopy = new Date(d)
      dateCopy.setHours(0, 0, 0, 0)
      return dateCopy.getTime()
    }

    allDeveloperMRs.forEach((mr) => {
      const date = new Date(mr.updatedAt || mr.createdAt)
      const timestamp = getMidnightTimestamp(date)
      if (activityMap.has(timestamp)) {
        activityMap.set(timestamp, activityMap.get(timestamp)! + 1)
      }
    })

    return chartInfo.chartDays.map((item) => {
      const dayEnd = item.timestamp + 24 * 60 * 60 * 1000
      const created = groupMRs.filter((mr) => mr.author.username === username && new Date(mr.createdAt).getTime() >= item.timestamp && new Date(mr.createdAt).getTime() < dayEnd).length
      const merged = groupMRs.filter((mr) => mr.author.username === username && mr.mergedAt && new Date(mr.mergedAt).getTime() >= item.timestamp && new Date(mr.mergedAt).getTime() < dayEnd).length
      return { timestamp: item.timestamp, dayLabel: item.dayLabel, dateLabel: item.dateLabel, count: activityMap.get(item.timestamp) || 0, created, merged }
    })
  }, [groupMRs, username, chartInfo])

  // 5. Navigate timeframe (previous/next)
  const handleNavigateTimeframe = (direction: 'prev' | 'next') => {
    setReferenceDate((current) => shiftReferenceDate(timeframe, current, direction))
  }

  // 6. Generate Markdown Content
  const markdownContent = useMemo(
    () => buildReportMarkdown({ name, username, groupName: selectedGroupName, timeframeLabel }, developerData),
    [name, username, selectedGroupName, timeframeLabel, developerData]
  )

  // 7. Generate HTML from Markdown
  const htmlContent = useMemo(() => {
    try {
      // sanitize ก่อน render — MR title/description เป็น user content จาก GitLab
      return DOMPurify.sanitize(marked.parse(markdownContent) as string)
    } catch (err) {
      console.error(err)
      return '<p className="text-red-500">Error rendering report.</p>'
    }
  }, [markdownContent])

  // Export handlers
  const handleExportMarkdown = async () => {
    setIsExporting('markdown')
    const filename = `${username}_report_${timeframe}.md`
    const success = await window.electronAPI.saveReportFile(filename, markdownContent)
    setIsExporting(null)
    if (success) alert('Markdown report saved successfully!')
  }

  const handleExportCSV = async () => {
    setIsExporting('excel')
    const filename = `${username}_report_${timeframe}.csv`
    const csv = buildReportCSV({ name, username, groupName: selectedGroupName, timeframeLabel }, developerData)
    const bom = '\uFEFF'
    const success = await window.electronAPI.saveReportFile(filename, bom + csv)
    setIsExporting(null)
    if (success) alert('Excel/CSV report saved successfully!')
  }

  const handleExportPDF = async () => {
    setIsExporting('pdf')
    const success = await window.electronAPI.exportReportPDF()
    setIsExporting(null)
    if (success) alert('PDF report saved successfully!')
  }

  // Filter lists inside right dashboard column based on search input
  const filteredMRs = useMemo(() => {
    const list =
      activeMRTab === 'authored'
        ? developerData.authored
        : activeMRTab === 'merged'
        ? developerData.merged
        : activeMRTab === 'reviewed'
        ? developerData.reviewed
        : attentionMRs

    if (!mrSearchQuery.trim()) return list
    return list.filter(
      (mr) =>
        mr.title.toLowerCase().includes(mrSearchQuery.toLowerCase()) ||
        String(mr.iid).includes(mrSearchQuery.trim()) ||
        mr.projectNamespace.toLowerCase().includes(mrSearchQuery.toLowerCase())
    )
  }, [activeMRTab, developerData, attentionMRs, mrSearchQuery])

  // Get color variables based on active MR tab for indicators
  const tabColorClass = useMemo(() => {
    if (activeMRTab === 'authored') return 'border-l-4 border-l-orange-500'
    if (activeMRTab === 'merged') return 'border-l-4 border-l-green-500'
    return activeMRTab === 'attention' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-blue-500'
  }, [activeMRTab])

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white select-text">
      {/* Top Header Row (Spacious & Clean Layout) */}
      <div className="px-8 py-4 bg-gray-900/90 border-b border-gray-800/80 flex items-center justify-between flex-shrink-0 no-print shadow-lg backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-11 h-11 rounded-full border border-gray-700 shadow-md flex-shrink-0 object-cover"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = FALLBACK_AVATAR
              }}
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gray-800 flex items-center justify-center text-lg border border-gray-700 flex-shrink-0">
              🦊
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-wide truncate">
                {name}
              </h1>
              <span className="bg-gray-800 border border-gray-700/70 text-gray-400 text-[10px] font-mono px-2 py-0.5 rounded-full">
                @{username}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5 truncate">{selectedGroupName}</p>
            {!personal && groupId && (
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-semibold text-gray-400">
                <label className="flex items-center gap-1.5">
                  <span className="text-gray-500">Member:</span>
                  <select 
                    value={selectedUsername} 
                    onChange={(event) => updateSelectedUser(event.target.value)} 
                    disabled={membersLoading || groupMembers.length === 0} 
                    className="max-w-[200px] rounded-md border border-gray-700 bg-gray-950 px-2 py-0.5 text-[10px] font-semibold text-gray-200 outline-none transition-colors hover:border-gray-600 focus:border-orange-500 disabled:cursor-wait disabled:opacity-60" 
                    aria-label="Select team member for this report"
                  >
                    {groupMembers.length === 0 ? (
                      <option value={selectedUsername}>{membersLoading ? 'Loading members…' : name}</option>
                    ) : (
                      groupMembers.map((member) => (
                        <option key={member.id} value={member.username}>
                          {member.name} (@{member.username})
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <span className="h-3 border-l border-gray-800" aria-hidden="true" />
                <button 
                  type="button" 
                  onClick={() => setIsComparisonPanelOpen(true)} 
                  disabled={membersLoading || groupMembers.length === 0} 
                  className="flex items-center gap-1 rounded-md border border-gray-700 bg-gray-950 px-2 py-0.5 text-[10px] font-semibold text-gray-300 transition-colors hover:border-orange-500/60 hover:text-orange-300 disabled:cursor-wait disabled:opacity-60"
                >
                  <Users className="w-3 h-3 text-orange-400" />
                  Compare{comparisonUsernames.length > 1 ? ` (${comparisonUsernames.length})` : ''}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center: Consolidated Timeframe Badge */}
        <div className="hidden md:flex items-center gap-2 bg-gray-950/80 border border-gray-800 px-3.5 py-1.5 rounded-full shadow-inner">
          <Calendar className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-xs font-semibold text-gray-200">{timeframeLabel}</span>
        </div>

        {/* Compact Premium Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportMarkdown}
            disabled={loading || isExporting !== null}
            className="flex items-center gap-1.5 bg-gray-800/90 hover:bg-gray-700 text-gray-200 text-[10px] font-semibold px-3 py-1.5 rounded-lg border border-gray-700/80 transition-all disabled:opacity-50 shadow-sm"
            title="Export report as Markdown file"
          >
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            Export MD
          </button>
          <button
            onClick={handleExportCSV}
            disabled={loading || isExporting !== null}
            className="flex items-center gap-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 text-[10px] font-semibold px-3 py-1.5 rounded-lg border border-emerald-800/50 transition-all disabled:opacity-50 shadow-sm"
            title="Export report as Excel/CSV spreadsheet"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            disabled={loading || isExporting !== null}
            className="flex items-center gap-1.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-[10px] font-semibold px-3.5 py-1.5 rounded-lg transition-all shadow-md shadow-orange-600/15 disabled:opacity-50"
            title="Export report as PDF document"
          >
            <FileDown className="w-3.5 h-3.5 text-white" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Main Content Layout with Spacious Gaps */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-400 text-xs">Loading performance data...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center max-w-md mx-auto">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <p className="text-red-400 text-sm font-semibold">{error}</p>
          </div>
        ) : (
          <>
            {/* Left Panel: Member Performance Summary */}
            <div className="w-80 flex flex-col gap-2.5 flex-shrink-0 overflow-y-auto overflow-x-hidden pr-0.5">
              
              <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-3 shadow-xl backdrop-blur-sm flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 border-b border-gray-800/80 pb-2">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-200">
                      Member Performance
                    </h2>
                    <p className="text-[10px] text-gray-500 mt-0.5">Individual Activity Overview</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold flex items-center gap-1.5 ${
                    workHealth.blocked > 0 
                      ? 'bg-red-500/15 text-red-300 border border-red-500/30' 
                      : workHealth.waitingOverSevenDays > 0 
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' 
                      : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      workHealth.blocked > 0 ? 'bg-red-400 animate-pulse' : workHealth.waitingOverSevenDays > 0 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`} />
                    {workHealth.blocked > 0 ? 'Needs attention' : workHealth.waitingOverSevenDays > 0 ? 'Watch list' : 'On track'}
                  </span>
                </div>

                {/* Stat KPI Cards Grid */}
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="rounded-xl bg-gray-950/60 border border-gray-800/60 p-2 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="text-[9px] font-bold uppercase tracking-wider">Created</span>
                      <GitPullRequest className="w-3 h-3 text-orange-400" />
                    </div>
                    <span className="mt-1 text-lg font-extrabold text-orange-400 leading-none">
                      {developerData.authored.length}
                    </span>
                  </div>

                  <div className="rounded-xl bg-gray-950/60 border border-gray-800/60 p-2 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="text-[9px] font-bold uppercase tracking-wider">Merged</span>
                      <GitMerge className="w-3 h-3 text-emerald-400" />
                    </div>
                    <span className="mt-1 text-lg font-extrabold text-emerald-400 leading-none">
                      {developerData.merged.length}
                    </span>
                  </div>

                  <div className="rounded-xl bg-gray-950/60 border border-gray-800/60 p-2 flex flex-col justify-between">
                    <div className="flex items-center justify-between text-gray-500">
                      <span className="text-[9px] font-bold uppercase tracking-wider">Reviewed</span>
                      <Eye className="w-3 h-3 text-blue-400" />
                    </div>
                    <span className="mt-1 text-lg font-extrabold text-blue-400 leading-none">
                      {developerData.reviewed.length}
                    </span>
                  </div>
                </div>

                {/* Action Required Banner */}
                <div className={`rounded-xl border p-2.5 transition-colors ${
                  attentionMRs.length > 0 ? 'border-amber-500/30 bg-amber-500/10' : 'border-emerald-500/20 bg-emerald-500/5'
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {attentionMRs.length > 0 ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      )}
                      <span className="text-[10px] font-bold text-gray-200">
                        {attentionMRs.length > 0 ? 'Action Required' : 'No Action Required'}
                      </span>
                    </div>
                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                      attentionMRs.length > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {attentionMRs.length}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[9px] text-gray-400 leading-tight">
                    {attentionMRs.length > 0 
                      ? `${workHealth.blocked} blocked · ${workHealth.waitingOverSevenDays} waiting over 7 days` 
                      : 'No blocked or ageing merge requests.'}
                  </p>
                </div>

                {/* Efficiency Metrics */}
                <div className="grid grid-cols-2 divide-x divide-gray-800/80 border-t border-gray-800/80 pt-2">
                  <div className="pr-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Merge Rate</span>
                    <span className="mt-0.5 text-sm font-extrabold text-emerald-400 block">
                      {workHealth.mergeRate === null ? '—' : `${workHealth.mergeRate}%`}
                    </span>
                  </div>
                  <div className="pl-2">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Avg Merge Time</span>
                    <span className="mt-0.5 text-sm font-extrabold text-purple-300 block">
                      {formatLeadTime(workHealth.averageLeadHours)}
                    </span>
                  </div>
                </div>

                {/* Top Projects */}
                <div className="border-t border-gray-800/80 pt-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <FolderGit2 className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Top Projects</span>
                  </div>
                  <div className="space-y-1">
                    {topProjects.length === 0 ? (
                      <span className="text-[10px] text-gray-500 italic block">No project activity in this period.</span>
                    ) : (
                      topProjects.slice(0, 3).map(({ project, count }) => (
                        <div key={project} className="flex items-center justify-between gap-2 text-[10px] bg-gray-950/40 px-2 py-1 rounded-lg border border-gray-800/40">
                          <span className="truncate text-gray-300 font-medium" title={project}>{project}</span>
                          <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-bold text-orange-300 flex-shrink-0">
                            {count} MR{count > 1 ? 's' : ''}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>

              {/* 7-Day Activity History Bar Chart */}
              <ActivityBarChart data={dailyActivity} />
            </div>

            {/* Right Panel: Contribution Details */}
            <div className="flex-1 flex flex-col bg-gray-900/60 border border-gray-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">
              
              {/* Header row: Control Bar */}
              <div className="bg-gray-950/50 border-b border-gray-800 flex flex-col flex-shrink-0">
                <div className="px-6 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                      Contribution Activity
                    </h2>
                  </div>

                  {/* Date Navigation & Timeframe Selector Toolbar */}
                  <div className="flex items-center gap-3">
                    {/* Date Stepper */}
                    <div className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg p-0.5">
                      <button
                        onClick={() => handleNavigateTimeframe('prev')}
                        className="w-6 h-6 flex items-center justify-center hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                        title="Previous Period"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setReferenceDate(new Date())}
                        className="px-2.5 h-6 flex items-center justify-center text-[10px] font-semibold text-gray-300 hover:text-white transition-colors"
                      >
                        {timeframe === 'daily' ? 'Today' : timeframe === 'weekly' ? 'This Week' : timeframe === 'monthly' ? 'This Month' : 'This Year'}
                      </button>
                      <button
                        onClick={() => handleNavigateTimeframe('next')}
                        className="w-6 h-6 flex items-center justify-center hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                        title="Next Period"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Timeframe Mode Selector (Day / Week / Month / Year) */}
                    <div className="flex gap-0.5 bg-gray-900 border border-gray-800 rounded-lg p-0.5">
                      {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setTimeframe(t)
                            setReferenceDate(new Date())
                          }}
                          className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
                            timeframe === t
                              ? 'bg-gray-800 text-orange-400 shadow-sm font-bold'
                              : 'text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          {t === 'daily' ? 'Day' : t === 'weekly' ? 'Week' : t === 'monthly' ? 'Month' : 'Year'}
                        </button>
                      ))}
                    </div>

                    {/* View Switcher (Dashboard / Raw MD) */}
                    <div className="flex gap-0.5 bg-gray-900 border border-gray-800 rounded-lg p-0.5">
                      <button
                        onClick={() => setActiveViewTab('dashboard')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-semibold transition-all ${
                          activeViewTab === 'dashboard'
                            ? 'bg-gray-800 text-orange-400 shadow-sm font-bold'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <LayoutDashboard className="w-3 h-3" />
                        Dashboard
                      </button>
                      <button
                        onClick={() => setActiveViewTab('markdown')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-semibold transition-all ${
                          activeViewTab === 'markdown'
                            ? 'bg-gray-800 text-orange-400 shadow-sm font-bold'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <FileText className="w-3 h-3" />
                        Raw MD
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Body: Render Dashboard or Raw Markdown */}
              {activeViewTab === 'markdown' ? (
                <div className="flex-1 overflow-y-auto p-8 print:bg-white print:text-black">
                  <div className="prose-content text-gray-200 print:text-black text-xs leading-relaxed max-w-2xl mx-auto">
                    <div 
                      dangerouslySetInnerHTML={{ __html: htmlContent }}
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        const anchor = target.closest('a');
                        if (anchor) {
                          e.preventDefault();
                          const href = anchor.getAttribute('href');
                          if (href) {
                            const mr = groupMRs.find(m => m.webUrl === href);
                            if (mr) {
                              window.electronAPI.openMRWindow(mr.projectId, mr.iid);
                            } else {
                              window.electronAPI.openUrl(href);
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Category tabs and Search bar */}
                  <div className="px-6 py-3 border-b border-gray-800/80 bg-gray-950/20 flex items-center justify-between flex-shrink-0 gap-3">
                    <div className="flex gap-1.5 bg-gray-950/60 rounded-xl p-1 border border-gray-800/60">
                      <button
                        onClick={() => setActiveMRTab('attention')}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                          activeMRTab === 'attention'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30 shadow-sm'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                        title="Open MRs with conflicts, a failed pipeline, or waiting more than 7 days"
                      >
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        Attention ({attentionMRs.length})
                      </button>
                      <button
                        onClick={() => setActiveMRTab('authored')}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                          activeMRTab === 'authored'
                            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30 shadow-sm'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <GitPullRequest className="w-3 h-3 text-orange-400" />
                        Created ({developerData.authored.length})
                      </button>
                      <button
                        onClick={() => setActiveMRTab('merged')}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                          activeMRTab === 'merged'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <GitMerge className="w-3 h-3 text-emerald-400" />
                        Merged ({developerData.merged.length})
                      </button>
                      <button
                        onClick={() => setActiveMRTab('reviewed')}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                          activeMRTab === 'reviewed'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <Eye className="w-3 h-3 text-blue-400" />
                        Reviewed ({developerData.reviewed.length})
                      </button>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search MR title or ID…"
                        value={mrSearchQuery}
                        onChange={(e) => setMRSearchQuery(e.target.value)}
                        className="bg-gray-950/80 border border-gray-800 text-white text-[10px] rounded-xl pl-8 pr-3 py-1.5 outline-none focus:border-orange-500/80 focus:ring-1 focus:ring-orange-500/40 placeholder-gray-600 w-56 transition-all"
                      />
                    </div>
                  </div>

                  {/* MR Scroll list with Accent Indicators */}
                  <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
                    {filteredMRs.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-xs py-16 gap-2 border border-dashed border-gray-800/80 rounded-2xl bg-gray-950/20">
                        <GitPullRequest className="w-8 h-8 text-gray-600 stroke-[1.5]" />
                        <p className="font-semibold text-gray-400">No Merge Requests found</p>
                        <p className="text-[10px] text-gray-500">
                          {mrSearchQuery ? 'Try clearing your search query.' : 'No items under this activity category.'}
                        </p>
                      </div>
                    ) : (
                      filteredMRs.map((mr) => (
                        <ReportMRCard
                          key={mr.id}
                          mr={mr}
                          accentClass={tabColorClass}
                          onOpen={(m) => window.electronAPI.openMRWindow(m.projectId, m.iid)}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {!personal && (
        <MemberComparisonModal
          isOpen={isComparisonPanelOpen}
          onClose={() => setIsComparisonPanelOpen(false)}
          members={groupMembers}
          selectedUsername={selectedUsername}
          comparisonUsernames={comparisonUsernames}
          toggleComparisonUser={toggleComparisonUser}
          comparisonRows={comparisonRows}
          timeframe={timeframe}
          setTimeframe={(t) => {
            setTimeframe(t)
            setReferenceDate(new Date())
          }}
          timeframeLabel={timeframeLabel}
          onNavigateTimeframe={handleNavigateTimeframe}
        />
      )}

      <style>{`
        .prose-content h1 {
          font-size: 1.5rem;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 0.5rem;
        }
        .prose-content h2 {
          font-size: 1.1rem;
          font-weight: 700;
          color: #f97316;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          border-bottom: 1px solid #374151;
          padding-bottom: 0.25rem;
        }
        .prose-content p {
          margin-bottom: 1rem;
        }
        .prose-content ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-bottom: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .prose-content li {
          color: #e5e7eb;
        }
        .prose-content a {
          color: #f97316;
          text-decoration: underline;
        }
        .prose-content a:hover {
          color: #fb923c;
        }
        .prose-content hr {
          border: 0;
          border-top: 1px solid #374151;
          margin: 1.5rem 0;
        }
        .prose-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1.5rem 0;
          background: rgba(17, 24, 39, 0.4);
          border-radius: 0.5rem;
          overflow: hidden;
        }
        .prose-content th {
          background: #1f2937;
          color: #ffffff;
          font-weight: 600;
          padding: 0.75rem 1rem;
          text-align: left;
          border-bottom: 1px solid #374151;
        }
        .prose-content td {
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #374151;
          color: #d1d5db;
        }
        .prose-content tr:last-child td {
          border-bottom: none;
        }
        .prose-content strong {
          color: #ffffff;
        }
        .prose-content em {
          color: #9ca3af;
          font-style: italic;
        }

        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background-color: white !important;
            color: black !important;
          }
          .prose-content h1, .prose-content h2, .prose-content strong {
            color: black !important;
          }
          .prose-content h2 {
            border-bottom: 1px solid #ccc !important;
          }
          .prose-content li {
            color: black !important;
          }
          .prose-content a {
            color: #1d4ed8 !important;
            text-decoration: none !important;
          }
          .prose-content th {
            background: #f3f4f6 !important;
            color: black !important;
            border-bottom: 1px solid #ccc !important;
          }
          .prose-content td {
            color: black !important;
            border-bottom: 1px solid #ccc !important;
          }
          .prose-content table {
            background: none !important;
          }
        }
      `}</style>
    </div>
  )
}

const FALLBACK_AVATAR =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%236b7280"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="%236b7280"/></svg>'
