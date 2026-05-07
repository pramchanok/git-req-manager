import { useState, useEffect } from 'react'
import type { AppState, UpdateState } from '../../shared/types'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'

type Page = 'dashboard' | 'settings'

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

    return () => {
      unsubscribe()
      unsubscribeUpdates()
    }
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white rounded-xl overflow-hidden shadow-2xl border border-gray-700">
      {/* Title bar (drag region) */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-800 border-b border-gray-700"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2">
          <span className="text-orange-400 text-sm font-bold">🦊 GitLab MR Manager</span>
          {appState.isSyncing && (
            <span className="text-xs text-gray-400 animate-pulse">syncing…</span>
          )}
        </div>
        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <button
            onClick={() => setPage(page === 'settings' ? 'dashboard' : 'settings')}
            className="relative p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title={page === 'settings' ? 'Back to dashboard' : 'Settings'}
          >
            {page === 'settings' ? '◀' : '⚙️'}
            {updateState.status === 'downloaded' && page !== 'settings' && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-green-400 rounded-full" />
            )}
          </button>
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
        ) : (
          <Settings
            onSaved={() => setPage('dashboard')}
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
            <span className="text-xs text-gray-600">v{updateState.currentVersion}</span>
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
