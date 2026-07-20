import type { GitLabUser, MergeRequest } from '../../../shared/types'
import { Loader2 } from 'lucide-react'

export type MRAction = 'approve' | 'unapprove' | 'merge' | 'close' | 'cancel-pipeline'

interface MRActionBarProps {
  mr: MergeRequest
  currentUser: GitLabUser | null
  activeAction: MRAction | null
  removeSourceBranch: boolean
  onRemoveSourceBranchChange: (checked: boolean) => void
  onBack: () => void
  onAction: (action: MRAction) => void
  onRequestClose: () => void
}

/** แถบ action ล่างสุด: Back / View on GitLab / Close / Approve / Merge */
export default function MRActionBar({
  mr,
  currentUser,
  activeAction,
  removeSourceBranch,
  onRemoveSourceBranchChange,
  onBack,
  onAction,
  onRequestClose,
}: MRActionBarProps) {
  const processingAction = activeAction !== null
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-[#0d1117]/80 backdrop-blur-xl border-t border-gray-800 py-2 px-4 z-30 shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.5)]">
      <div className="max-w-5xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-6">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back
          </button>
          <div className="h-4 w-px bg-gray-700" />
          <button
            onClick={() => window.electronAPI.openUrl(mr.webUrl)}
            className="text-orange-400 hover:text-orange-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            View on GitLab
          </button>
        </div>

        <div className="flex items-center gap-3">
          {mr.state === 'opened' && (
            <>
              <button
                onClick={onRequestClose}
                disabled={processingAction || (currentUser?.id !== mr.author.id && !mr.userCanMerge)}
                title={currentUser?.id !== mr.author.id && !mr.userCanMerge ? "You don't have permission to close this MR" : "Close MR"}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 mr-3 ${
                  currentUser?.id !== mr.author.id && !mr.userCanMerge
                    ? 'text-gray-500 border-gray-700 bg-gray-800/50 cursor-not-allowed'
                    : 'text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20 hover:border-red-500/50'
                }`}
              >
                {activeAction === 'close' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                )}
                {activeAction === 'close' ? 'Closing…' : 'Close MR'}
              </button>
              <div className="h-4 w-px bg-gray-700 mr-3" />

              {mr.hasApproved ? (
                <button
                  onClick={() => onAction('unapprove')}
                  disabled={processingAction}
                  title="Revoke approval"
                  className="text-xs font-semibold py-1.5 px-4 rounded-lg transition-all flex items-center gap-2 bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 disabled:opacity-50"
                >
                  {activeAction === 'unapprove' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  )}
                  {activeAction === 'unapprove' ? 'Revoking…' : 'Revoke approval'}
                </button>
              ) : (
                <button
                  onClick={() => onAction('approve')}
                  disabled={processingAction || currentUser?.id === mr.author.id}
                  title={currentUser?.id === mr.author.id ? "You cannot approve your own MR" : "Approve"}
                  className={`text-xs font-semibold py-1.5 px-4 rounded-lg transition-all flex items-center gap-2 ${
                    currentUser?.id === mr.author.id
                      ? 'bg-gray-800/50 text-gray-500 border border-gray-700 cursor-not-allowed'
                      : 'bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/30 disabled:opacity-50'
                  }`}
                >
                  {activeAction === 'approve' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  )}
                  {activeAction === 'approve' ? 'Approving…' : 'Approve'}
                </button>
              )}

              <button
                onClick={() => onRemoveSourceBranchChange(!removeSourceBranch)}
                role="switch"
                aria-checked={removeSourceBranch}
                title="ลบ source branch หลัง merge สำเร็จ"
                className={`text-xs font-medium py-1.5 px-3 rounded-lg border transition-all flex items-center gap-2 select-none ${
                  removeSourceBranch
                    ? 'bg-blue-500/10 text-blue-300 border-blue-500/40'
                    : 'bg-gray-800/60 text-gray-500 border-gray-700 hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete source branch
                {/* mini toggle track */}
                <span className={`relative w-6 h-3.5 rounded-full transition-colors ${removeSourceBranch ? 'bg-blue-500' : 'bg-gray-600'}`}>
                  <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${removeSourceBranch ? 'left-3' : 'left-0.5'}`} />
                </span>
              </button>
              <button
                onClick={() => onAction('merge')}
                disabled={processingAction || mr.hasConflicts || mr.mergeWhenPipelineSucceeds || !mr.userCanMerge}
                className={`text-white text-xs font-semibold py-1.5 px-4 rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] disabled:opacity-50 disabled:shadow-none flex items-center gap-2 border border-transparent ${
                  !mr.userCanMerge
                    ? 'bg-gray-800 text-gray-500 border-gray-700 shadow-none cursor-not-allowed'
                    : mr.mergeWhenPipelineSucceeds
                    ? 'bg-indigo-900/50 text-indigo-300 border-indigo-500/30 shadow-none'
                    : mr.pipelineStatus === 'running'
                    ? 'bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:border-gray-600'
                    : 'bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:border-gray-600'
                }`}
                title={!mr.userCanMerge ? "You don't have permission to merge" : mr.hasConflicts ? 'Has conflicts' : mr.mergeWhenPipelineSucceeds ? 'Auto-merge already enabled' : mr.pipelineStatus === 'running' ? 'Merge when pipeline succeeds' : 'Merge'}
              >
                {activeAction === 'merge' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                )}
                {activeAction === 'merge' ? 'Merging…' : mr.mergeWhenPipelineSucceeds ? 'Auto-Merge Enabled' : mr.pipelineStatus === 'running' ? 'Auto-Merge' : 'Merge'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
