import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { FileText, ChevronDown, RefreshCw, Download, CheckCircle2, Pin } from 'lucide-react'
import type { AppState, UpdateState } from '../shared/types'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import TeamReport from './pages/TeamReport'
import Changelog from './pages/Changelog'
import Toast, { type ToastData, type ToastType } from './components/Toast'

// Code splitting: หน้าเหล่านี้ลากไลบรารีหนัก (md-editor, emoji-mart, parse-diff, chart) —
// แยก chunk เพื่อให้หน้าต่างหลัก (Dashboard ใน tray) เปิดเร็ว
const ReportDetail = lazy(() => import('./pages/ReportDetail'))
const MRDetail = lazy(() => import('./pages/MRDetail'))
const LeadOverview = lazy(() => import('./pages/LeadOverview'))

function PageLoader() {
  return (
    <div className="flex flex-col h-screen bg-[#0d1117] items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

type Page = 'dashboard' | 'settings' | 'team-report' | 'changelog' | 'report' | 'mr-detail' | 'lead-overview'

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
      className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 transition-all duration-200 relative ${active ? 'text-orange-400' : 'text-gray-500 hover:text-gray-300'
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
  const [versionMenuOpen, setVersionMenuOpen] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
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
    ownerGroups: [],
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
  const manualUpdateCheckRef = useRef(false)

  useEffect(() => {
    // Load initial state
    window.electronAPI.getAppState().then(setAppState)
    window.electronAPI.getUpdateState().then(setUpdateState)
    window.electronAPI.shouldShowChangelog().then((shouldShow) => {
      if (shouldShow) setPage('changelog')
    })

    // Listen for state updates from main process
    const unsubscribe = window.electronAPI.onAppStateUpdated((state) => {
      setAppState(state)
    })
    const unsubscribeUpdates = window.electronAPI.onUpdateStateChanged((state) => {
      setUpdateState(state)

      if (manualUpdateCheckRef.current) {
        if (state.status === 'not-available') {
          showToast('แอปของคุณเป็นเวอร์ชันล่าสุดแล้ว 🎉', 'success')
          manualUpdateCheckRef.current = false
        } else if (state.status === 'available') {
          showToast('พบเวอร์ชันใหม่! กำลังเตรียมดาวน์โหลด...', 'info')
          manualUpdateCheckRef.current = false
        } else if (state.status === 'error') {
          showToast('เกิดข้อผิดพลาดในการตรวจสอบอัปเดต', 'error')
          manualUpdateCheckRef.current = false
        }
      }
    })

    const unsubscribeSyncStatus = window.electronAPI.onSyncStatusUpdated((isSyncing) => {
      setAppState((prev) => ({ ...prev, isSyncing }))
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
      unsubscribeSyncStatus()
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
    return (
      <Suspense fallback={<PageLoader />}>
        <ReportDetail />
      </Suspense>
    )
  }

  if (page === 'mr-detail') {
    return (
      <Suspense fallback={<PageLoader />}>
        <MRDetail
          projectId={Number(new URLSearchParams(window.location.search).get('projectId'))}
          mrIid={Number(new URLSearchParams(window.location.search).get('mrIid'))}
          onBack={() => window.close()}
          onRefresh={() => {
            // For a separate window, we might not trigger a global sync, but we can call it.
            window.electronAPI.triggerSync()
          }}
          onToast={showToast}
        />
      </Suspense>
    )
  }

  if (page === 'lead-overview') {
    return <Suspense fallback={<PageLoader />}><LeadOverview /></Suspense>
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
            <div className="relative flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <button
                onClick={() => setVersionMenuOpen(!versionMenuOpen)}
                className={`flex items-center gap-0.5 text-[10px] font-medium transition-colors select-none px-1.5 py-0.5 rounded-sm hover:bg-gray-800 border border-transparent hover:border-gray-700 ${updateState.status === 'downloaded'
                  ? 'text-green-400 hover:text-green-300'
                  : updateState.status === 'available' || updateState.status === 'downloading'
                    ? 'text-orange-400 hover:text-orange-300'
                    : 'text-gray-400 hover:text-gray-300'
                  } ${versionMenuOpen ? 'bg-gray-800 border-gray-700' : ''}`}
                title="Version Options"
              >
                v{updateState.currentVersion}
                {updateState.status === 'downloaded' && ' ⬆️'}
                {updateState.status === 'checking' && ' 🔄'}
                {(updateState.status === 'available' || updateState.status === 'downloading') && ' ↑'}
                <ChevronDown size={10} className={`opacity-60 transition-transform ${versionMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {versionMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setVersionMenuOpen(false)} />
                  <div className="absolute top-full left-0 mt-1 w-44 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 py-1 flex flex-col font-medium text-[11px] overflow-hidden">
                    <button
                      className="flex flex-col gap-1.5 px-3 py-2 hover:bg-gray-800 text-left transition-colors w-full"
                      onClick={() => {
                        setVersionMenuOpen(false)
                        if (updateState.status === 'downloaded') {
                          window.electronAPI.installUpdate()
                        } else {
                          manualUpdateCheckRef.current = true
                          showToast('กำลังตรวจสอบการอัปเดต...', 'info')
                          window.electronAPI.checkForUpdates()
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {updateState.status === 'downloaded' ? <CheckCircle2 size={12} className="text-green-400" /> :
                          updateState.status === 'downloading' ? <Download size={12} className="text-orange-400 animate-pulse" /> :
                            <RefreshCw size={12} className={`text-gray-400 ${updateState.status === 'checking' ? 'animate-spin' : ''}`} />}

                        <span className={updateState.status === 'downloaded' ? 'text-green-400' : updateState.status === 'downloading' ? 'text-orange-400' : 'text-gray-300'}>
                          {updateState.status === 'downloaded' ? 'Restart to Install Update' :
                            updateState.status === 'checking' ? 'Checking for updates...' :
                              updateState.status === 'downloading' ? `Downloading update... ${updateState.progressPercent ?? ''}%` :
                                'Check for Updates'}
                        </span>
                      </div>

                      {updateState.status === 'downloading' && (
                        <div className="w-full h-1 bg-gray-950 rounded-full overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-orange-400 transition-all duration-300 ease-out"
                            style={{ width: `${updateState.progressPercent ?? 0}%` }}
                          />
                        </div>
                      )}
                    </button>
                    <div className="h-px bg-gray-800 my-0.5" />
                    <button
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 text-gray-300 text-left transition-colors"
                      onClick={() => {
                        setVersionMenuOpen(false)
                        setPage('changelog')
                      }}
                    >
                      <FileText size={12} className="text-gray-400" />
                      View Changelog
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Title bar controls (no-drag) */}
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="flex items-center mr-1 select-none pointer-events-none">
            {appState.lastSyncedAt && !appState.isSyncing && (
              <span className="text-[10px] text-gray-500 font-medium">
                {new Date(appState.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {appState.isSyncing && (
              <span className="text-[9px] text-orange-400 animate-pulse bg-orange-950/40 px-1.5 py-0.5 rounded-full font-semibold">syncing…</span>
            )}
          </div>
          <button
            onClick={() => window.electronAPI.triggerSync()}
            disabled={appState.isSyncing}
            className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition-colors text-xs disabled:opacity-30"
            title="Refresh now"
          >
            <span className={appState.isSyncing ? 'inline-block animate-spin' : ''}>↻</span>
          </button>
          <button
            onClick={() => {
              const newPinned = !isPinned
              setIsPinned(newPinned)
              window.electronAPI.setPinned(newPinned)
            }}
            className={`w-5 h-5 flex items-center justify-center rounded-full transition-colors text-[10px] ${
              isPinned ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30' : 'hover:bg-gray-800 text-gray-400 hover:text-white'
            }`}
            title={isPinned ? 'Unpin window (Auto-hide on blur)' : 'Pin window (Keep on top)'}
          >
            <Pin size={10} className={isPinned ? 'fill-current transform rotate-45' : ''} />
          </button>
          <button
            onClick={() => window.electronAPI.hideWindow()}
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
            onCheckForUpdates={() => {
              manualUpdateCheckRef.current = true
              showToast('กำลังตรวจสอบการอัปเดต...', 'info')
              return window.electronAPI.checkForUpdates()
            }}
            onInstallUpdate={() => window.electronAPI.installUpdate()}
          />
        )}
      </div>

      {/* Update Banner */}
      {(updateState.status === 'available' || updateState.status === 'downloading' || updateState.status === 'downloaded') && (
        <div 
          className="border-t border-gray-800 bg-gray-900 px-3 py-2 flex items-center justify-between flex-shrink-0 cursor-pointer hover:bg-gray-800 transition-colors shadow-[0_-4px_12px_rgba(0,0,0,0.2)] z-10"
          onClick={() => {
            if (updateState.status === 'downloaded') {
              window.electronAPI.installUpdate()
            } else {
              setPage('changelog')
            }
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-full ${updateState.status === 'downloaded' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
              {updateState.status === 'downloaded' ? (
                <CheckCircle2 size={12} strokeWidth={2.5} />
              ) : (
                <Download size={12} className={updateState.status === 'downloading' ? 'animate-pulse' : ''} strokeWidth={2.5} />
              )}
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[11px] font-medium text-gray-200">
                {updateState.status === 'downloaded' 
                  ? 'Update ready to install' 
                  : `Downloading update v${updateState.availableVersion || '...'}`}
              </span>
              {updateState.status === 'downloading' && (
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-24 bg-gray-950 rounded-full h-1 overflow-hidden border border-gray-800">
                    <div className="bg-orange-400 h-full rounded-full transition-all duration-300 ease-out" style={{ width: `${updateState.progressPercent ?? 0}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
          {updateState.status === 'downloaded' ? (
            <button 
              className="bg-green-500 hover:bg-green-600 text-white text-[10px] px-2.5 py-1 rounded shadow-sm font-semibold transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                window.electronAPI.installUpdate()
              }}
            >
              Restart
            </button>
          ) : (
            <span className="text-[10px] text-gray-400 font-medium px-1">View</span>
          )}
        </div>
      )}

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
