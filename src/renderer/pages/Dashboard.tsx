import { useState } from 'react'
import type { AppState, MRTab } from '../../../shared/types'
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
      <div className="flex bg-gray-800 border-b border-gray-700">
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

      {/* MR List */}
      <div className="flex-1 overflow-y-auto scroll-hide">
        {appState.isSyncing && mrs.length === 0 ? (
          <div className="flex flex-col">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : mrs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
            <div className="text-3xl">✅</div>
            <p className="text-gray-400 text-sm">
              {activeTab === 'myReviews'
                ? 'No MRs waiting for your review.'
                : 'No open MRs found.'}
            </p>
          </div>
        ) : (
          mrs.map((mr) => <MRCard key={mr.id} mr={mr} />)
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

function TabButton({ label, count, active, onClick, highlightCount }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
        active
          ? 'text-white border-b-2 border-orange-400'
          : 'text-gray-400 hover:text-gray-200'
      }`}
    >
      {label}
      {count > 0 && (
        <span
          className={`text-xs px-1.5 py-0.5 rounded-full ${
            active && highlightCount
              ? 'bg-orange-500 text-white'
              : 'bg-gray-700 text-gray-300'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )
}
