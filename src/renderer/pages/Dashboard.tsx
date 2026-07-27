import { useState } from 'react'
import type { AppState, MRTab, MergeRequest } from '../../shared/types'
import MRCard from '../components/MRCard'
import SkeletonCard from '../components/SkeletonCard'
import { Search, ArrowUpDown, Activity, Wifi, Shield, ArrowUpRight } from 'lucide-react'

type SortOption = 'updated_desc' | 'updated_asc' | 'approvals_asc'

interface DashboardProps {
  appState: AppState
}

export default function Dashboard({ appState }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<MRTab>('myReviews')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('updated_desc')
  const [showStatus, setShowStatus] = useState(false)

  const baseMrs = activeTab === 'myReviews' ? appState.myReviewMRs : appState.allOpenMRs
  const reviewCount = appState.myReviewMRs.length
  const allCount = appState.allOpenMRs.length

  // Filter
  let mrs = baseMrs
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    mrs = mrs.filter((mr) => 
      (mr.title || '').toLowerCase().includes(q) || 
      (mr.author?.name || '').toLowerCase().includes(q) ||
      (mr.projectName || '').toLowerCase().includes(q)
    )
  }

  // Sort
  mrs = [...mrs].sort((a, b) => {
    if (sortOption === 'updated_desc') {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    }
    if (sortOption === 'updated_asc') {
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    }
    if (sortOption === 'approvals_asc') {
      const aLeft = a.approvalsLeft
      const bLeft = b.approvalsLeft
      if (aLeft !== bLeft) return aLeft - bLeft
      // Tie breaker: updated
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    }
    return 0
  })

  const hasPreviousData = Boolean(
    appState.lastSyncedAt || appState.myReviewMRs.length > 0 || appState.allOpenMRs.length > 0
  )

  if (!appState.isConfigured && !appState.isSyncing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <div className="text-4xl">🔧</div>
        <p className="text-gray-400 text-sm">
          Configure your GitLab URL and Personal Access Token to get started.
        </p>
        <p className="text-gray-600 text-xs">Open the Settings tab to get started.</p>
      </div>
    )
  }

  if (appState.error && !hasPreviousData) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 text-center">
        <div className="text-3xl">⚠️</div>
        <p className="text-red-400 text-sm">{appState.error}</p>
        <button
          onClick={() => window.electronAPI.triggerSync()}
          className="text-xs text-blue-400 hover:underline"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs & Status */}
      <div className="flex bg-gray-900 px-3 py-2 border-b border-gray-800/80 items-center justify-between flex-shrink-0 select-none relative">
        <div className="w-8" /> {/* Spacer for centering */}

        <div className="bg-gray-950 p-0.5 rounded-lg flex w-full max-w-[250px] border border-gray-800/60">
          <TabButton
            label="My Reviews"
            count={reviewCount}
            active={activeTab === 'myReviews'}
            onClick={() => setActiveTab('myReviews')}
            highlightCount
          />
          <TabButton
            label="All Open"
            count={allCount}
            active={activeTab === 'allOpen'}
            onClick={() => setActiveTab('allOpen')}
          />
        </div>

        <button
          onClick={() => setShowStatus(!showStatus)}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors relative ${showStatus ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
          title="System Status"
        >
          <Activity className="w-4 h-4" />
          {appState.error && <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-gray-900" />}
        </button>

        {showStatus && (
          <div className="absolute top-full right-3 mt-1 w-64 bg-gray-800 border border-gray-700 shadow-xl rounded-lg z-50 overflow-hidden flex flex-col text-xs">
            <div className="bg-gray-900 px-3 py-2 font-semibold text-gray-300 border-b border-gray-700">System Status</div>
            <div className="p-3 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Wifi className={`w-4 h-4 ${appState.error ? 'text-red-400' : 'text-green-400'}`} />
                <div className="flex flex-col">
                  <span className="text-gray-200">GitLab API Sync</span>
                  <span className="text-gray-500 text-[10px]">
                    {appState.lastSyncedAt ? new Date(appState.lastSyncedAt).toLocaleTimeString() : 'Never'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-400" />
                <div className="flex flex-col">
                  <span className="text-gray-200">App State</span>
                  <span className="text-gray-500 text-[10px]">{appState.isConfigured ? 'Configured' : 'Missing Config'}</span>
                </div>
              </div>
              {appState.error && (
                <div className="mt-1 p-2 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-[10px]">
                  {appState.error}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {appState.error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-b border-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-300"
        >
          <span className="min-w-0 truncate" title={appState.error}>{appState.error}</span>
          <button
            onClick={() => window.electronAPI.triggerSync()}
            disabled={appState.isSyncing}
            className="shrink-0 text-blue-300 hover:text-blue-200 hover:underline disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex bg-gray-900/50 px-3 py-2 border-b border-gray-800/50 gap-2 flex-shrink-0">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
            <Search className="w-3.5 h-3.5 text-gray-500" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search MRs..."
            className="bg-gray-800 border border-gray-700 rounded pl-7 pr-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-400 w-full transition-colors"
          />
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
            <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
          </div>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            className="appearance-none bg-gray-800 border border-gray-700 rounded pl-7 pr-6 py-1 text-xs text-white focus:outline-none focus:border-orange-400 transition-colors"
          >
            <option value="updated_desc">Recently Updated</option>
            <option value="updated_asc">Oldest Waiting</option>
            <option value="approvals_asc">Approvals Pending</option>
          </select>
          <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center pointer-events-none text-gray-500">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        </div>
      </div>

      {/* MR List */}
      <div className="flex-1 overflow-y-auto scroll-hide">
        {appState.isSyncing && baseMrs.length === 0 ? (
          <div className="flex flex-col">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : mrs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6 py-10 animate-fade-in select-none">
            <div className="relative w-16 h-16 flex items-center justify-center">
              {/* Outer decorative circle */}
              <div className="absolute inset-0 rounded-full bg-gray-800/40 border border-gray-700/50 scale-110" />
              
              <svg
                className="w-10 h-10 relative z-10"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="gradientCheck" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#ea580c" />
                  </linearGradient>
                </defs>
                {activeTab === 'myReviews' ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    stroke="url(#gradientCheck)"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    stroke="url(#gradientCheck)"
                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                )}
              </svg>
            </div>
            <div>
              <p className="text-gray-200 text-sm font-semibold">
                {activeTab === 'myReviews'
                  ? 'All caught up!'
                  : 'No open Merge Requests'}
              </p>
              <p className="text-gray-500 text-xs mt-1 max-w-[260px] leading-relaxed">
                {activeTab === 'myReviews'
                  ? 'No Merge Requests are waiting for your review.'
                  : 'No open Merge Requests were found in your configured projects.'}
              </p>
            </div>
          </div>
        ) : (
          mrs.map((mr: MergeRequest) => <MRCard key={mr.id} mr={mr} />)
        )}
      </div>
    </div>
  )
}

interface TabButtonProps {
  label: string
  count: number
  active: boolean
  onClick: () => void
  highlightCount?: boolean
}

function TabButton({ label, count, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all duration-150 flex items-center justify-center gap-1.5 ${
        active
          ? 'bg-orange-500 text-white shadow-sm'
          : 'text-gray-400 hover:text-gray-200'
      }`}
    >
      {label}
      {count > 0 && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
            active
              ? 'bg-orange-600/80 text-white'
              : 'bg-gray-800 text-gray-400'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}
