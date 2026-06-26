import { useState, useEffect, useCallback } from 'react'
import type { AppState, UpdateState } from '../../shared/types'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import TeamReport from './pages/TeamReport'
import Changelog from './pages/Changelog'
import ReportDetail from './pages/ReportDetail'
import Toast, { type ToastData, type ToastType } from './components/Toast'

type Page = 'dashboard' | 'settings' | 'team-report' | 'changelog' | 'report'

type BadgeColor = 'green' | 'amber' | null

interface BottomTabProps {
  label: string
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  badge?: BadgeColor
}

function BottomTab({ label, active, onClick, icon, badge }: BottomTabProps) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 transition-all duration-200 relative ${
        active ? 'text-orange-400' : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      <div className="relative flex items-center justify-center">
        {icon}
        {badge === 'green' && (
          <span className="absolute -top-1.5 -right-1.5 w-1.5 h-1.5 rounded-full bg-green-500" />
        )}
        {badge === 'amber' && (
          <span className="absolute -top-1.5 -right-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        )}
      </div>
      <span className="text-[9px] font-bold tracking-wide uppercase select-none">{label}</span>
    </button>
  )
}

function DashboardIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  )
}

function TeamIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>(() => {
    const params = new URLSearchParams(window.location.search)
    return (params.get('page') as Page) || 'dashboard'
  })
  const [toast, setToast] = useState<ToastData | null>(null)
  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type })
  }, [])
  const [appState, setAppState] = useState<AppState>({
    myReviewMRs: [],
    allOpenMRs: [],
    lastSyncedAt: null,
    isSyncing: false,
    error: null,
    currentUser: null,
    isConfigured: false,
  })
  const [updateState, setUpdateState] = useState<UpdateState>({
    currentVersion: '',
    status: 'idle',
    availableVersion: null,
    downloadedVersion: null,
    progressPercent: null,
    message: null,
    releaseDate: null,
    releaseNotes: null,
  })

  useEffect(() => {
    // Load initial state
    window.electronAPI.getAppState().then(setAppState)
    window.electronAPI.getUpdateState().then(setUpdateState)

    // Listen for state updates from main process
    const unsubscribe = window.electronAPI.onAppStateUpdated((state) => {
      setAppState(state)
    })
    const unsubscribeUpdates = window.electronAPI.onUpdateStateChanged((state) => {
      setUpdateState(state)
    })

    const unsubscribeShowSettings = window.electronAPI.onShowSettings(() => {
      setPage('settings')
    })

    const unsubscribeShowChangelog = window.electronAPI.onShowChangelog(() => {
      setPage('changelog')
    })

    return () => {
      unsubscribe()
      unsubscribeUpdates()
      unsubscribeShowSettings()
      unsubscribeShowChangelog()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && page !== 'dashboard') {
        setPage('dashboard')
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault()
        window.electronAPI.triggerSync()
      } else if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        setPage('settings')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [page])

  if (page === 'report') {
    return <ReportDetail appState={appState} />
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white rounded-xl overflow-hidden shadow-2xl border border-gray-700">
      {/* Title Bar (drag region) */}
      <div
        className="flex items-center justify-between h-9 bg-gray-900 border-b border-gray-950 px-4 flex-shrink-0 select-none"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="text-orange-400 font-bold">🦊 GitLab MR Manager</span>
          {updateState.currentVersion && (
            <button
              onClick={() => setPage('changelog')}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className={`text-[10px] font-medium transition-colors select-none ${
                updateState.status === 'downloaded'
                  ? 'text-green-400 hover:text-green-300'
                  : updateState.status === 'available' || updateState.status === 'downloading'
                  ? 'text-amber-400 hover:text-amber-300 animate-pulse'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              title="ดูสิ่งที่เปลี่ยนแปลง"
            >
              v{updateState.currentVersion}
              {updateState.status === 'downloaded' && ' ⬆️'}
              {(updateState.status === 'available' || updateState.status === 'downloading') && ' ↑'}
            </button>
          )}
          {appState.lastSyncedAt && !appState.isSyncing && (
            <span className="text-[10px] text-gray-500 font-medium">
              · {new Date(appState.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          {appState.isSyncing && (
            <span className="text-[9px] text-orange-400 animate-pulse bg-orange-950/40 px-1.5 py-0.5 rounded-full font-semibold">syncing…</span>
          )}
        </div>

        {/* Title bar controls (no-drag) */}
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => window.electronAPI.triggerSync()}
            disabled={appState.isSyncing}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors text-xs disabled:opacity-30"
            title="Refresh now"
          >
            ↻
          </button>
          <button
            onClick={() => window.close()}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-600 hover:text-white text-gray-400 hover:text-white transition-colors text-[10px]"
            title="Hide to tray"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden bg-gray-900 flex flex-col">
        {page === 'dashboard' ? (
          <Dashboard appState={appState} />
        ) : page === 'team-report' ? (
          <TeamReport appState={appState} />
        ) : page === 'changelog' ? (
          <Changelog onBack={() => setPage('dashboard')} currentVersion={updateState.currentVersion} />
        ) : (
          <Settings
            onSaved={() => setPage('dashboard')}
            onToast={showToast}
            onShowChangelog={() => setPage('changelog')}
            updateState={updateState}
            onCheckForUpdates={() => window.electronAPI.checkForUpdates()}
            onInstallUpdate={() => window.electronAPI.installUpdate()}
          />
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="h-12 bg-gray-950 border-t border-gray-900 flex items-stretch flex-shrink-0">
        <BottomTab
          label="Dashboard"
          active={page === 'dashboard' || page === 'changelog'}
          onClick={() => setPage('dashboard')}
          icon={<DashboardIcon />}
        />
        <BottomTab
          label="Team"
          active={page === 'team-report'}
          onClick={() => setPage('team-report')}
          icon={<TeamIcon />}
        />
        <BottomTab
          label="Settings"
          active={page === 'settings'}
          onClick={() => setPage('settings')}
          icon={<SettingsIcon />}
          badge={
            updateState.status === 'downloaded'
              ? 'green'
              : updateState.status === 'available' || updateState.status === 'downloading'
              ? 'amber'
              : null
          }
        />
      </div>

      {toast && (
        <Toast {...toast} onDismiss={() => setToast(null)} />
      )}
    </div>
  )
}
