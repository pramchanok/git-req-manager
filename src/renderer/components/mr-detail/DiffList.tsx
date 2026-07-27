import { memo } from 'react'
import type { MRDiff } from '../../../shared/types'
import { CustomDiffViewer } from '../CustomDiffViewer'
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react'

interface DiffListProps {
  diffs: MRDiff[]
  loading: boolean
  viewedFiles: Set<string>
  onToggleViewed: (path: string) => void
  onCopyPath: (path: string) => void
  onOpenInIDE: (path: string) => void
  copiedPath: string | null
  openingPath: string | null
  diffStats: Map<string, { additions: number; deletions: number }>
  viewMode: 'inline' | 'split'
}

/** ลิสต์ diff ของทุกไฟล์ในแท็บ Changes พร้อม checkbox "Viewed" */
function DiffList({ diffs, loading, viewedFiles, onToggleViewed, onCopyPath, onOpenInIDE, copiedPath, openingPath, diffStats, viewMode }: DiffListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (diffs.length === 0) {
    return (
      <div className="text-center py-12 bg-[#161b22] border border-gray-800 border-dashed rounded-xl">
        <p className="text-gray-500 text-sm">No changes found in this merge request.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {diffs.map((diff) => {
        const filePath = diff.newPath && diff.newPath !== '/dev/null' ? diff.newPath : diff.oldPath
        const isViewed = viewedFiles.has(filePath)
        const stats = diffStats.get(diff.newPath)
        return (
          <div id={`diff-${diff.newPath}`} key={diff.newPath} className={`diff-file-card scroll-mt-4 bg-[#161b22] border ${isViewed ? 'border-gray-800/40 opacity-70' : 'border-gray-800'} rounded-xl overflow-hidden shadow-sm transition-[opacity,border-color] duration-150`}>
            {/* File Header */}
            <div className="bg-gray-800/50 px-4 py-2 text-sm font-mono text-gray-300 border-b border-gray-800 flex justify-between items-center group">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <svg className="w-4 h-4 text-gray-500 group-hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className={`min-w-0 truncate ${isViewed ? 'line-through text-gray-500' : ''}`} title={filePath}>{filePath}</span>
                {stats && (
                  <span className="flex items-center gap-1.5 ml-2">
                    {stats.additions > 0 && <span className="text-[10px] text-green-400 font-bold">+{stats.additions}</span>}
                    {stats.deletions > 0 && <span className="text-[10px] text-red-400 font-bold">-{stats.deletions}</span>}
                  </span>
                )}
                {diff.newFile && <span className="bg-green-500/10 text-green-400 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold border border-green-500/20">New</span>}
                {diff.deletedFile && <span className="bg-red-500/10 text-red-400 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold border border-red-500/20">Deleted</span>}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onCopyPath(filePath)}
                  title="Copy file path"
                  aria-label={`Copy path ${filePath}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-700/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                >
                  {copiedPath === filePath ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenInIDE(filePath)}
                  disabled={openingPath === filePath}
                  title="Open file in IDE"
                  aria-label={`Open ${filePath} in IDE`}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-700/80 bg-gray-900/50 px-2 text-[11px] font-sans font-medium text-gray-300 transition-colors hover:border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500/60 disabled:cursor-wait disabled:opacity-60"
                >
                  {openingPath === filePath ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">IDE</span>
                </button>
                <label className="flex items-center gap-2 text-xs font-sans text-gray-400 hover:text-gray-200 cursor-pointer select-none pl-1">
                  Viewed
                  <input
                    type="checkbox"
                    checked={isViewed}
                    onChange={() => onToggleViewed(filePath)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-orange-500 focus:ring-orange-500/50 cursor-pointer"
                  />
                </label>
              </div>
            </div>
            {/* Diff Viewer Wrapper */}
            {!isViewed && (
              <CustomDiffViewer diffString={diff.diff} viewMode={viewMode} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default memo(DiffList)
