import { useState, useEffect, useMemo } from 'react'
import { marked } from 'marked'
import type { MergeRequest, GitLabGroup, GitLabUser } from '../../shared/types'

interface ReportDetailProps {
  appState: any
}

// ── SVG Donut Chart Component ────────────────────────────────────────────────
function DonutChart({ created, merged, reviewed }: { created: number; merged: number; reviewed: number }) {
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

// ── 7-Day Activity History Bar Chart Component ───────────────────────────────
function ActivityBarChart({ data }: { data: { timestamp: number; dayLabel: string; dateLabel?: string; count: number }[] }) {
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

// ── Main Page Component ──────────────────────────────────────────────────────
export default function ReportDetail({ appState }: ReportDetailProps) {
  const [loading, setLoading] = useState(true)
  const [groupMRs, setGroupMRs] = useState<MergeRequest[]>([])
  const [groups, setGroups] = useState<GitLabGroup[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState<string | null>(null)
  
  // UI States
  const [activeViewTab, setActiveViewTab] = useState<'dashboard' | 'markdown'>('dashboard')
  const [activeMRTab, setActiveMRTab] = useState<'authored' | 'merged' | 'reviewed'>('authored')
  const [mrSearchQuery, setMRSearchQuery] = useState('')

  // Timeframe and Reference Date State (Making report detail dynamic & interactive)
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>(() => {
    const params = new URLSearchParams(window.location.search)
    return (params.get('timeframe') || 'weekly') as 'daily' | 'weekly' | 'monthly'
  })
  const [referenceDate, setReferenceDate] = useState<Date>(new Date())

  // Parse remaining query params
  const { username, name, avatarUrl, groupId } = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      username: params.get('username') || '',
      name: params.get('name') || '',
      avatarUrl: params.get('avatarUrl') || '',
      groupId: params.get('groupId') ? Number(params.get('groupId')) : null,
    }
  }, [])

  // 1. Load groups to find group name
  useEffect(() => {
    window.electronAPI.getGitLabGroups().then(setGroups).catch(console.error)
  }, [])

  const selectedGroupName = useMemo(() => {
    if (!groupId) return 'All Groups'
    const g = groups.find((group) => group.id === groupId)
    return g ? g.name : `Group #${groupId}`
  }, [groups, groupId])

  // 2. Calculate date range dynamically
  const { sinceIso, timeframeLabel } = useMemo(() => {
    const d = new Date(referenceDate)
    let label = ''

    if (timeframe === 'daily') {
      d.setHours(0, 0, 0, 0)
      label = `Daily Report (${d.toLocaleDateString()})`
    } else if (timeframe === 'weekly') {
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      d.setDate(diff)
      d.setHours(0, 0, 0, 0)
      const end = new Date(d)
      end.setDate(end.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      label = `Weekly Report: ${d.toLocaleDateString()} - ${end.toLocaleDateString()}`
    } else if (timeframe === 'monthly') {
      d.setDate(1)
      d.setHours(0, 0, 0, 0)
      label = `Monthly Report: ${d.toLocaleString('default', { month: 'long', year: 'numeric' })}`
    }

    return {
      sinceIso: d.toISOString(),
      timeframeLabel: label,
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
          dateLabel: `${d2.getDate()} ${d2.toLocaleString('default', { month: 'short' })}`
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
          dateLabel: `${d2.getDate()} ${d2.toLocaleString('default', { month: 'short' })}`
        })
      }
    }

    const chartSinceIso = new Date(result[0].timestamp).toISOString()
    return {
      chartDays: result,
      chartSinceIso
    }
  }, [timeframe, referenceDate])

  // Fetch from the earliest date needed (minimum of timeframe start and chart start)
  const fetchSinceIso = useMemo(() => {
    const reportTime = new Date(sinceIso).getTime()
    const chartTime = new Date(chartInfo.chartSinceIso).getTime()
    return new Date(Math.min(reportTime, chartTime)).toISOString()
  }, [sinceIso, chartInfo])

  // 3. Fetch Group MRs in this timeframe
  useEffect(() => {
    if (!groupId) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    window.electronAPI
      .getGroupMRsInTimeframe(groupId, fetchSinceIso)
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
  }, [groupId, fetchSinceIso])

  // 4. Filter and Aggregate data for target developer
  const developerData = useMemo(() => {
    const authored = groupMRs.filter(
      (mr) => mr.author.username === username && mr.createdAt >= sinceIso
    )

    const merged = groupMRs.filter(
      (mr) =>
        mr.author.username === username &&
        mr.state === 'merged' &&
        mr.mergedAt &&
        mr.mergedAt >= sinceIso
    )

    const reviewed = groupMRs.filter(
      (mr) =>
        mr.author.username !== username &&
        (mr.reviewers.some((r) => r.username === username) ||
          mr.assignees.some((a) => a.username === username)) &&
        mr.updatedAt >= sinceIso
    )

    return { authored, merged, reviewed }
  }, [groupMRs, username, sinceIso])

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

    return chartInfo.chartDays.map((item) => ({
      timestamp: item.timestamp,
      dayLabel: item.dayLabel,
      dateLabel: item.dateLabel,
      count: activityMap.get(item.timestamp) || 0,
    }))
  }, [groupMRs, username, chartInfo])

  // 5. Navigate timeframe (previous/next)
  const handleNavigateTimeframe = (direction: 'prev' | 'next') => {
    const offset = direction === 'prev' ? -1 : 1
    const newDate = new Date(referenceDate)

    if (timeframe === 'daily') {
      newDate.setDate(newDate.getDate() + offset)
    } else if (timeframe === 'weekly') {
      newDate.setDate(newDate.getDate() + offset * 7)
    } else if (timeframe === 'monthly') {
      newDate.setMonth(newDate.getMonth() + offset)
    }

    setReferenceDate(newDate)
  }

  // 6. Generate Markdown Content
  const markdownContent = useMemo(() => {
    const formatMRList = (mrs: MergeRequest[]) => {
      if (mrs.length === 0) return '_No Merge Requests._\n'
      return mrs
        .map((mr, idx) => {
          const stateBadge = mr.state === 'merged' ? '✅ Merged' : mr.state === 'closed' ? '❌ Closed' : '🔵 Open'
          const dateStr = new Date(mr.createdAt).toLocaleDateString()
          return `${idx + 1}. **!${mr.iid}**: [${mr.title.replace(/[\[\]]/g, '\\$&')}](${mr.webUrl}) - [${stateBadge}] (Created: ${dateStr})`
        })
        .join('\n')
    }

    return `# Developer Contribution Report: ${name} (@${username})

* **Group:** ${selectedGroupName}
* **Period:** ${timeframeLabel}
* **Generated At:** ${new Date().toLocaleString()}

---

## 📊 Summary of Contributions

| Contribution Type | Count |
| :--- | :---: |
| **MRs Created (สร้าง)** | **${developerData.authored.length}** |
| **MRs Merged (สลักเสร็จสิ้น)** | **${developerData.merged.length}** |
| **MRs Reviewed / Assigned (ตรวจทาน/รับมอบหมาย)** | **${developerData.reviewed.length}** |

---

## ✍️ Created Merge Requests (${developerData.authored.length})

${formatMRList(developerData.authored)}

## 🏆 Merged Merge Requests (${developerData.merged.length})

${formatMRList(developerData.merged)}

## 👁️ Reviewed / Assigned Merge Requests (${developerData.reviewed.length})

${formatMRList(developerData.reviewed)}
`
  }, [name, username, selectedGroupName, timeframeLabel, developerData])

  // 7. Generate HTML from Markdown
  const htmlContent = useMemo(() => {
    try {
      return marked.parse(markdownContent)
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

    let csv = `Developer Performance Report\n`
    csv += `Name,${name} (@${username})\n`
    csv += `Group,${selectedGroupName}\n`
    csv += `Timeframe,${timeframeLabel}\n`
    csv += `Generated At,${new Date().toLocaleString()}\n\n`

    csv += `Summary Metrics\n`
    csv += `Metric,Value\n`
    csv += `MRs Created,${developerData.authored.length}\n`
    csv += `MRs Merged,${developerData.merged.length}\n`
    csv += `MRs Reviewed / Assigned,${developerData.reviewed.length}\n\n`

    csv += `Detailed Activity List\n`
    csv += `Activity Type,MR IID,Title,State,Created At,URL\n`

    const addRows = (list: MergeRequest[], type: string) => {
      list.forEach((mr) => {
        const cleanTitle = mr.title.replace(/"/g, '""')
        csv += `"${type}",${mr.iid},"${cleanTitle}","${mr.state}","${new Date(mr.createdAt).toLocaleDateString()}","${mr.webUrl}"\n`
      })
    }

    addRows(developerData.authored, 'Created')
    addRows(developerData.merged, 'Merged')
    addRows(developerData.reviewed, 'Reviewed/Assigned')

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
        : developerData.reviewed

    if (!mrSearchQuery.trim()) return list
    return list.filter(
      (mr) =>
        mr.title.toLowerCase().includes(mrSearchQuery.toLowerCase()) ||
        String(mr.iid).includes(mrSearchQuery.trim()) ||
        mr.projectNamespace.toLowerCase().includes(mrSearchQuery.toLowerCase())
    )
  }, [activeMRTab, developerData, mrSearchQuery])

  // Get color variables based on active MR tab for indicators
  const tabColorClass = useMemo(() => {
    if (activeMRTab === 'authored') return 'border-l-4 border-l-orange-500'
    if (activeMRTab === 'merged') return 'border-l-4 border-l-green-500'
    return 'border-l-4 border-l-blue-500'
  }, [activeMRTab])

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white select-text">
      {/* Top Header Row (Spacious & Clean Layout) */}
      <div className="px-8 py-5 bg-gray-950/70 border-b border-gray-800/80 flex items-center justify-between flex-shrink-0 no-print shadow-md">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="w-12 h-12 rounded-full border border-gray-700 shadow-md flex-shrink-0"
              onError={(e) => {
                ;(e.target as HTMLImageElement).src = FALLBACK_AVATAR
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-xl border border-gray-700 flex-shrink-0">
              🦊
            </div>
          )}
          <div>
            <h1 className="text-base font-extrabold text-white tracking-wide">
              {name}
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">@{username} · {selectedGroupName}</p>
          </div>
        </div>

        {/* Compact Premium Export Buttons in window header */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportMarkdown}
            disabled={loading || isExporting !== null}
            className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg border border-gray-700/80 transition-all disabled:opacity-50"
          >
            Export MD
          </button>
          <button
            onClick={handleExportCSV}
            disabled={loading || isExporting !== null}
            className="flex items-center gap-1.5 bg-green-950/80 hover:bg-green-900 text-green-300 text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg border border-green-800/50 transition-all disabled:opacity-50"
          >
            Export Excel
          </button>
          <button
            onClick={handleExportPDF}
            disabled={loading || isExporting !== null}
            className="flex items-center gap-1.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-2 rounded-lg transition-all shadow-md shadow-orange-600/10 disabled:opacity-50"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Main Content Layout with Spacious Gaps (UX 2026 style) */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2.5">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-400 text-xs">Loading performance data...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center max-w-md mx-auto">
            <span className="text-3xl">⚠️</span>
            <p className="text-red-400 text-sm font-semibold">{error}</p>
          </div>
        ) : (
          <>
            {/* Left Panel: Stats and Charts side-by-side inside cards (Saves huge vertical space) */}
            <div className="w-88 flex flex-col gap-4 flex-shrink-0 overflow-y-auto scroll-hide">
              
              {/* Contribution Overview Card (Combines Donut and text stats side-by-side) */}
              <div className="bg-gray-800/40 border border-white/5 rounded-2xl p-5 flex flex-col gap-4 shadow-xl">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Contribution Distribution
                </span>

                <div className="flex items-center gap-5">
                  {/* Left: Donut chart */}
                  <DonutChart
                    created={developerData.authored.length}
                    merged={developerData.merged.length}
                    reviewed={developerData.reviewed.length}
                  />

                  {/* Right: Clean vertical list of stats */}
                  <div className="flex-1 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between border-b border-gray-800/80 pb-1.5">
                      <span className="text-[10px] text-gray-400 flex items-center gap-1.5 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/20"></span> Created
                      </span>
                      <span className="text-xs font-black text-white">{developerData.authored.length}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-gray-800/80 pb-1.5">
                      <span className="text-[10px] text-gray-400 flex items-center gap-1.5 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-500/20"></span> Merged
                      </span>
                      <span className="text-xs font-black text-white">{developerData.merged.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400 flex items-center gap-1.5 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/20"></span> Reviewed
                      </span>
                      <span className="text-xs font-black text-white">{developerData.reviewed.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 7-Day Activity History Card (Will fit perfectly now) */}
              <ActivityBarChart data={dailyActivity} />
            </div>

            {/* Right Panel: Content View (Spacious glassmorphic card) */}
            <div className="flex-1 flex flex-col bg-gray-800/30 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
              
              {/* Header row of Right Column: Split into Title/View row and Controls row */}
              <div className="bg-gray-950/30 border-b border-gray-800 flex flex-col flex-shrink-0">
                {/* Row 1: Title & View Tabs */}
                <div className="px-6 py-3 flex items-center justify-between border-b border-gray-800/50">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">
                      Contribution Report
                    </span>
                    <h2 className="text-xs font-black text-orange-400 mt-0.5 tracking-wide truncate">
                      {timeframeLabel}
                    </h2>
                  </div>

                  {/* View Tabs Selector (Dashboard / Raw MD) */}
                  <div className="flex gap-1 bg-gray-900 border border-gray-800/80 rounded-xl p-1 shadow-inner">
                    <button
                      onClick={() => setActiveViewTab('dashboard')}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
                        activeViewTab === 'dashboard'
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/10'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      📊 Dashboard
                    </button>
                    <button
                      onClick={() => setActiveViewTab('markdown')}
                      className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 ${
                        activeViewTab === 'markdown'
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/10'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      📝 Raw MD
                    </button>
                  </div>
                </div>

                {/* Row 2: Navigation & Timeframe Controls */}
                <div className="px-6 py-2.5 flex items-center justify-between bg-gray-950/15">
                  {/* Date Navigation Toolbar */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleNavigateTimeframe('prev')}
                      className="w-7 h-7 flex items-center justify-center bg-gray-900 hover:bg-gray-800 border border-gray-800/60 rounded-lg text-xs transition-colors text-gray-400 hover:text-white"
                      title="Previous Period"
                    >
                      ◀
                    </button>
                    <button
                      onClick={() => setReferenceDate(new Date())}
                      className="px-3 h-7 flex items-center justify-center text-[9px] font-bold bg-gray-900 hover:bg-gray-800 border border-gray-800/60 text-gray-300 hover:text-white rounded-lg transition-colors"
                    >
                      {timeframe === 'daily' ? 'Today' : timeframe === 'weekly' ? 'This Week' : 'This Month'}
                    </button>
                    <button
                      onClick={() => handleNavigateTimeframe('next')}
                      className="w-7 h-7 flex items-center justify-center bg-gray-900 hover:bg-gray-800 border border-gray-800/60 rounded-lg text-xs transition-colors text-gray-400 hover:text-white"
                      title="Next Period"
                    >
                      ▶
                    </button>
                  </div>

                  {/* Timeframe Selector (Day / Week / Month) */}
                  <div className="flex gap-1 bg-gray-900 border border-gray-800/80 rounded-xl p-1 shadow-inner">
                    {(['daily', 'weekly', 'monthly'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setTimeframe(t)
                          setReferenceDate(new Date())
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all duration-200 ${
                          timeframe === t
                            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/10'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {t === 'daily' ? 'Day' : t === 'weekly' ? 'Week' : 'Month'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Body: Render Dashboard or Raw Markdown */}
              {activeViewTab === 'markdown' ? (
                <div className="flex-1 overflow-y-auto p-8 print:bg-white print:text-black">
                  <div className="prose-content text-gray-200 print:text-black text-xs leading-relaxed max-w-2xl mx-auto">
                    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Category tabs and Search bar */}
                  <div className="px-6 py-4 border-b border-gray-800/80 bg-gray-950/10 flex items-center justify-between flex-shrink-0 gap-3">
                    {/* Fixed Category Tabs overlapping spacing: Added gap-1.5 and padding p-1 */}
                    <div className="flex gap-1.5 bg-gray-900 rounded-xl p-1 border border-gray-800/80">
                      <button
                        onClick={() => setActiveMRTab('authored')}
                        className={`px-3.5 py-1.5 rounded-md text-[10px] font-bold transition-all duration-200 ${
                          activeMRTab === 'authored'
                            ? 'bg-orange-500/20 text-orange-400 font-bold'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        Created ({developerData.authored.length})
                      </button>
                      <button
                        onClick={() => setActiveMRTab('merged')}
                        className={`px-3.5 py-1.5 rounded-md text-[10px] font-bold transition-all duration-200 ${
                          activeMRTab === 'merged'
                            ? 'bg-green-500/20 text-green-400 font-bold'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        Merged ({developerData.merged.length})
                      </button>
                      <button
                        onClick={() => setActiveMRTab('reviewed')}
                        className={`px-3.5 py-1.5 rounded-md text-[10px] font-bold transition-all duration-200 ${
                          activeMRTab === 'reviewed'
                            ? 'bg-blue-500/20 text-blue-400 font-bold'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        Reviewed ({developerData.reviewed.length})
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Search MR title or ID…"
                      value={mrSearchQuery}
                      onChange={(e) => setMRSearchQuery(e.target.value)}
                      className="bg-gray-900 border border-gray-800 text-white text-[10px] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-orange-500 placeholder-gray-600 w-52 transition-all"
                    />
                  </div>

                  {/* MR Scroll list with Accent Indicators */}
                  <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
                    {filteredMRs.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-xs">
                        No Merge Requests found.
                      </div>
                    ) : (
                      filteredMRs.map((mr) => (
                        <div
                          key={mr.id}
                          onClick={() => window.electronAPI.openUrl(mr.webUrl)}
                          className={`bg-gray-800/30 hover:bg-gray-800/80 border border-gray-800/60 hover:border-gray-700/80 rounded-xl p-4 transition-all duration-350 cursor-pointer flex flex-col gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 group ${tabColorClass}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-[10px] text-gray-400 font-bold font-mono bg-gray-955/40 px-2 py-0.5 rounded-md flex-shrink-0">
                              !{mr.iid}
                            </span>
                            <h3 className="text-xs font-bold text-white group-hover:text-orange-400 transition-colors leading-relaxed flex-1 line-clamp-2">
                              {mr.title}
                            </h3>
                            <span
                              className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider flex-shrink-0 ${
                                mr.state === 'merged'
                                  ? 'bg-green-950/50 text-green-400 border border-green-900/40'
                                  : mr.state === 'closed'
                                  ? 'bg-red-950/50 text-red-400 border border-red-900/40'
                                  : 'bg-blue-950/50 text-blue-400 border border-blue-900/40'
                              }`}
                            >
                              {mr.state}
                            </span>
                          </div>

                          <div className="flex items-center justify-between mt-0.5 text-[9px] text-gray-500 font-semibold">
                            <span className="bg-gray-950/20 text-gray-400 px-2 py-0.5 rounded-md truncate max-w-[280px]">
                              📁 {mr.projectNamespace || 'Unknown Project'}
                            </span>
                            <span className="text-gray-500">
                              Created: {new Date(mr.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

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
