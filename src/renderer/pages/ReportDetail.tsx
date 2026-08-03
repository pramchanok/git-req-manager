import { useState, useEffect, useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { MergeRequest, GitLabGroup } from '../../shared/types'
import DonutChart from '../components/report/DonutChart'
import ActivityBarChart from '../components/report/ActivityBarChart'
import ReportMRCard from '../components/report/ReportMRCard'
import { buildReportMarkdown, buildReportCSV } from '../utils/reportBuilder'
import { getTimeframeRange, shiftReferenceDate, isWithin, type Timeframe } from '../utils/timeframe'

// ── Main Page Component ──────────────────────────────────────────────────────
export default function ReportDetail() {
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
  const [timeframe, setTimeframe] = useState<Timeframe>(() => {
    const params = new URLSearchParams(window.location.search)
    return (params.get('timeframe') || 'weekly') as Timeframe
  })
  const [referenceDate, setReferenceDate] = useState<Date>(new Date())

  // Parse remaining query params
  const { username, name, avatarUrl, groupId, personal } = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      username: params.get('username') || '',
      name: params.get('name') || '',
      avatarUrl: params.get('avatarUrl') || '',
      groupId: params.get('groupId') ? Number(params.get('groupId')) : null,
      personal: params.get('personal') === 'true',
    }
  }, [])

  // 1. Load groups to find group name
  useEffect(() => {
    window.electronAPI.getGitLabGroups().then(setGroups).catch(console.error)
  }, [])

  const selectedGroupName = useMemo(() => {
    if (personal) return 'My accessible projects'
    if (!groupId) return 'All Groups'
    const g = groups.find((group) => group.id === groupId)
    return g ? g.name : `Group #${groupId}`
  }, [groups, groupId, personal])

  // 2. Calculate date range dynamically
  const { sinceIso, untilIso, timeframeLabel } = useMemo(() => {
    const range = getTimeframeRange(timeframe, referenceDate)
    const prefix =
      timeframe === 'daily' ? 'Daily Report' : timeframe === 'weekly' ? 'Weekly Report' : 'Monthly Report'
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
