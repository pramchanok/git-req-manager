import { useState, useEffect } from 'react'
import type { AppState, UpdateState } from '../../shared/types'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import TeamReport from './pages/TeamReport'
import Changelog from './pages/Changelog'

type Page = 'dashboard' | 'settings' | 'team-report' | 'changelog'

type BadgeColor = 'green' | 'amber' | null

interface NavTabProps {
  label: string
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  badge?: BadgeColor
}

function NavTab({ label, active, onClick, icon, badge }: NavTabProps) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 flex flex-col items-center py-1.5 gap-0.5 text-[10px] font-medium transition-colors ${
        active
          ? 'text-orange-400 border-b-2 border-orange-400'
          : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      {icon}
      {label}
      {badge === 'green' && (
        <span className="absolute top-1 right-[calc(50%-10px)] w-1.5 h-1.5 rounded-full bg-green-400" />
      )}
      {badge === 'amber' && (
        <span className="absolute top-1 right-[calc(50%-10px)] w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      )}
    </button>
  )
}

function DashboardIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
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
  const [page, setPage] = useState<Page>('dashboard')
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

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white rounded-xl overflow-hidden shadow-2xl border border-gray-700">
      {/* Title bar (drag region) */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-800"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <span className="text-orange-400 text-sm font-bold">🦊 GitLab MR Manager</span>
          {appState.isSyncing && (
            <span className="text-xs text-gray-400 animate-pulse">syncing…</span>
          )}
        </div>
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => window.close()}
            className="p-1 rounded hover:bg-red-700 text-gray-500 hover:text-white transition-colors text-xs"
            title="Hide to tray"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Navigation bar */}
      <div
        className="flex bg-gray-800 border-b border-gray-700"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <NavTab
          label="Dashboard"
          active={page === 'dashboard' || page === 'changelog'}
          onClick={() => setPage('dashboard')}
          icon={<DashboardIcon />}
        />
        <NavTab
          label="Team"
          active={page === 'team-report'}
          onClick={() => setPage('team-report')}
          icon={<TeamIcon />}
        />
        <NavTab
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

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {page === 'dashboard' ? (
          <Dashboard appState={appState} />
        ) : page === 'team-report' ? (
          <TeamReport appState={appState} />
        ) : page === 'changelog' ? (
          <Changelog onBack={() => setPage('dashboard')} currentVersion={updateState.currentVersion} />
        ) : (
          <Settings
            onSaved={() => setPage('dashboard')}
            onShowChangelog={() => setPage('changelog')}
            updateState={updateState}
            onCheckForUpdates={() => window.electronAPI.checkForUpdates()}
            onInstallUpdate={() => window.electronAPI.installUpdate()}
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 bg-gray-800 border-t border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xs text-gray-500">
            {appState.lastSyncedAt
              ? `Last sync: ${new Date(appState.lastSyncedAt).toLocaleTimeString()}`
              : 'Not synced yet'}
          </span>
          {updateState.currentVersion && (
            <button
              onClick={() => setPage('changelog')}
              className={`text-xs transition-colors ${
                updateState.status === 'downloaded'
                  ? 'text-green-400 hover:text-green-300'
                  : updateState.status === 'available' || updateState.status === 'downloading'
                  ? 'text-amber-400 hover:text-amber-300 animate-pulse'
                  : 'text-gray-600 hover:text-gray-400'
              }`}
              title="ดูสิ่งที่เปลี่ยนแปลง"
            >
              v{updateState.currentVersion}
              {updateState.status === 'downloaded' && ' ⬆️'}
              {(updateState.status === 'available' || updateState.status === 'downloading') && ' ↑'}
            </button>
          )}
        </div>
        <button
          onClick={() => window.electronAPI.triggerSync()}
          disabled={appState.isSyncing}
          className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600 transition-colors"
        >
          {appState.isSyncing ? 'Syncing…' : '↻ Refresh'}
        </button>
      </div>
    </div>
  )
}
