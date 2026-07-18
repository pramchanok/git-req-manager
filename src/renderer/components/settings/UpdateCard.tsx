import DOMPurify from 'dompurify'
import { RefreshCw, Download, CheckCircle2, ChevronRight, FileText } from 'lucide-react'
import type { UpdateState } from '../../../shared/types'

interface UpdateCardProps {
  updateState: UpdateState
  onCheckForUpdates: () => Promise<unknown>
  onInstallUpdate: () => Promise<unknown>
  onShowChangelog: () => void
}

/** การ์ด App Updates (เช็ค/ดาวน์โหลด/ติดตั้งอัปเดต + release notes + ลิงก์ changelog) */
export default function UpdateCard({
  updateState,
  onCheckForUpdates,
  onInstallUpdate,
  onShowChangelog,
}: UpdateCardProps) {
  const updateActionDisabled = updateState.status === 'checking' || updateState.status === 'downloading'
  const updateActionLabel = updateState.status === 'checking'
    ? 'Checking…'
    : updateState.status === 'downloading'
      ? `Downloading${updateState.progressPercent !== null ? ` ${updateState.progressPercent}%` : '…'}`
      : 'Check for Updates'

  return (
    <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <div className={`mt-0.5 flex-shrink-0 p-2 rounded-lg border ${
              updateState.status === 'downloaded' ? 'bg-green-900/30 border-green-800/50 text-green-400' :
              updateState.status === 'downloading' ? 'bg-orange-900/30 border-orange-800/50 text-orange-400' :
              'bg-gray-800 border-gray-700 text-gray-400'
            }`}>
              {updateState.status === 'downloaded' ? <CheckCircle2 size={16} /> :
               updateState.status === 'downloading' ? <Download size={16} className="animate-pulse" /> :
               <RefreshCw size={16} className={updateState.status === 'checking' ? 'animate-spin' : ''} />}
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-200">App Updates</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-gray-500">
                  Version {updateState.currentVersion ? `v${updateState.currentVersion}` : '—'}
                </p>
                {updateState.status === 'not-available' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 font-medium border border-gray-700">Up to date</span>
                )}
              </div>
            </div>
          </div>

          {updateState.status === 'downloaded' ? (
            <button
              onClick={() => void onInstallUpdate()}
              className="bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg px-3.5 py-1.5 transition-colors shadow-sm"
            >
              Restart to Update
            </button>
          ) : (
            <button
              onClick={() => void onCheckForUpdates()}
              disabled={updateActionDisabled}
              className="bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 disabled:text-gray-600 text-gray-300 text-xs font-medium rounded-lg px-3.5 py-1.5 transition-colors border border-gray-700 disabled:border-transparent flex items-center justify-center min-w-[120px]"
            >
              {updateActionLabel}
            </button>
          )}
        </div>

        {(updateState.message || updateState.status === 'downloading') && (
          <div className="flex flex-col gap-1.5 mt-1 ml-[44px]">
            <div className="flex items-center justify-between text-xs">
              <span className={updateState.status === 'error' ? 'text-red-400' : 'text-gray-400'}>
                {updateState.status === 'downloading' && updateState.availableVersion
                  ? `Downloading v${updateState.availableVersion}...`
                  : updateState.message}
              </span>
              {updateState.status === 'downloading' && updateState.progressPercent !== null && (
                <span className="text-gray-500 font-medium tabular-nums">{updateState.progressPercent}%</span>
              )}
            </div>

            {updateState.status === 'downloading' && (
              <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-300 ease-out"
                  style={{ width: `${updateState.progressPercent ?? 0}%` }}
                />
              </div>
            )}
          </div>
        )}

        {updateState.releaseNotes && (updateState.status === 'available' || updateState.status === 'downloaded' || updateState.status === 'downloading') && (
          <div className="mt-2 pt-3 border-t border-gray-800/50 ml-[44px]">
            <details className="text-xs group">
              <summary className="text-gray-400 cursor-pointer select-none hover:text-gray-300 transition-colors flex items-center gap-1.5">
                <ChevronRight size={14} className="group-open:rotate-90 transition-transform" />
                Release Notes for v{updateState.availableVersion}
              </summary>
              <div
                className="mt-2.5 p-3 bg-gray-950/50 rounded-lg text-gray-400 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed border border-gray-800/50"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(updateState.releaseNotes) }}
              />
            </details>
          </div>
        )}
      </div>

      <div className="px-4 py-2.5 bg-gray-950 border-t border-gray-800/50 flex items-center justify-between">
        <p className="text-[10px] text-gray-500">
          Automatically checks for updates on startup
        </p>
        <button
          onClick={onShowChangelog}
          className="text-[10px] font-medium text-gray-400 hover:text-white transition-colors flex items-center gap-1"
        >
          <FileText size={12} />
          View Changelog
        </button>
      </div>
    </div>
  )
}
