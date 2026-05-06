import type { MergeRequest } from '../../../shared/types'

interface MRCardProps {
  mr: MergeRequest
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function MRCard({ mr }: MRCardProps) {
  const handleOpen = () => window.electronAPI.openUrl(mr.webUrl)

  return (
    <div
      className="px-3 py-2.5 border-b border-gray-700 hover:bg-gray-750 cursor-pointer group transition-colors"
      onClick={handleOpen}
    >
      <div className="flex items-start gap-2">
        {/* Author avatar */}
        <img
          src={mr.author.avatarUrl}
          alt={mr.author.name}
          className="w-7 h-7 rounded-full flex-shrink-0 mt-0.5"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src =
              'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%236b7280"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="%236b7280"/></svg>'
          }}
        />

        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className="text-sm text-white font-medium leading-snug truncate group-hover:text-blue-300 transition-colors">
            {mr.draft && <span className="text-yellow-500 mr-1 text-xs">Draft</span>}
            {mr.title}
          </p>

          {/* Meta */}
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-400 truncate max-w-[120px]">
              {mr.projectName || mr.projectNamespace}
            </span>
            <span className="text-gray-600 text-xs">·</span>
            <span className="text-xs text-gray-500">
              !{mr.iid}
            </span>
            <span className="text-gray-600 text-xs">·</span>
            <span className="text-xs text-gray-500">{timeAgo(mr.createdAt)}</span>
          </div>

          {/* Branch */}
          <div className="mt-0.5">
            <span className="text-xs text-gray-600 font-mono">
              {mr.sourceBranch} → {mr.targetBranch}
            </span>
          </div>
        </div>

        {/* Right side badges */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {mr.hasConflicts && (
            <span className="text-xs bg-red-900 text-red-300 px-1.5 py-0.5 rounded">
              conflict
            </span>
          )}
          {mr.userNotesCount > 0 && (
            <span className="text-xs text-gray-500">💬 {mr.userNotesCount}</span>
          )}
          {mr.upvotes > 0 && (
            <span className="text-xs text-green-500">👍 {mr.upvotes}</span>
          )}
        </div>
      </div>
    </div>
  )
}
