import { useState } from 'react'
import type { AppState, MRTab, MergeRequest } from '../../shared/types'
import MRCard from '../components/MRCard'
import SkeletonCard from '../components/SkeletonCard'

interface DashboardProps {
  appState: AppState
}

export default function Dashboard({ appState }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<MRTab>('myReviews')

  const mrs = activeTab === 'myReviews' ? appState.myReviewMRs : appState.allOpenMRs
  const reviewCount = appState.myReviewMRs.length
  const allCount = appState.allOpenMRs.length

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

  if (appState.error) {
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
      {/* Tabs */}
      <div className="flex bg-gray-900 px-3 py-2 border-b border-gray-800/80 justify-center flex-shrink-0 select-none">
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
      </div>

      {/* MR List */}
      <div className="flex-1 overflow-y-auto scroll-hide">
        {appState.isSyncing && mrs.length === 0 ? (
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
