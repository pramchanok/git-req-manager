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
  badge?: BadgeColor
}

function NavTab({ label, active, onClick, badge }: NavTabProps) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 h-full text-xs font-medium transition-colors border-b-2 whitespace-nowrap ${
        active
          ? 'text-orange-400 border-orange-400'
          : 'text-gray-500 hover:text-gray-300 border-transparent'
      }`}
    >
      {label}
      {badge === 'green' && (
        <span className="absolute top-1.5 right-0.5 w-1.5 h-1.5 rounded-full bg-green-400" />
      )}
      {badge === 'amber' && (
        <span className="absolute top-1.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      )}
    </button>
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
      {/* Title + nav bar (single row, drag region) */}
      <div
        className="flex items-stretch h-10 bg-gray-800 border-b border-gray-700 flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* App name (drag zone) */}
        <div className="flex items-center gap-2 pl-3 pr-2 flex-shrink-0 select-none">
          <span className="text-orange-400 text-sm font-bold">🦊 GitLab MR</span>
          {appState.isSyncing && (
            <span className="text-xs text-gray-400 animate-pulse">syncing…</span>
          )}
        </div>

        {/* Nav tabs (no-drag) */}
        <div
          className="flex flex-1 items-stretch"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <NavTab
            label="Dashboard"
            active={page === 'dashboard' || page === 'changelog'}
            onClick={() => setPage('dashboard')}
          />
          <NavTab
            label="Team"
            active={page === 'team-report'}
            onClick={() => setPage('team-report')}
          />
          <NavTab
            label="Settings"
            active={page === 'settings'}
            onClick={() => setPage('settings')}
            badge={
              updateState.status === 'downloaded'
                ? 'green'
                : updateState.status === 'available' || updateState.status === 'downloading'
                ? 'amber'
                : null
            }
          />
        </div>

        {/* Close button (no-drag) */}
        <div
          className="flex items-center px-2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={() => window.close()}
            className="p-1 rounded hover:bg-red-700 text-gray-500 hover:text-white transition-colors text-xs"
            title="Hide to tray"
          >
            ✕
          </button>
        </div>
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
