import type { GitLabUser, MergeRequest, MRLabel } from '../../../shared/types'

interface MRCardProps {
  mr: MergeRequest
}

const FALLBACK_AVATAR =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%236b7280"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="%236b7280"/></svg>'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function Avatar({ user, size = 'sm' }: { user: GitLabUser; size?: 'sm' | 'xs' }) {
  const cls = size === 'xs' ? 'w-5 h-5' : 'w-7 h-7'
  return (
    <img
      src={user.avatarUrl}
      alt={user.name}
      title={user.name}
      className={`${cls} rounded-full flex-shrink-0`}
      onError={(e) => {
        ;(e.target as HTMLImageElement).src = FALLBACK_AVATAR
      }}
    />
  )
}

function AvatarStack({ users, max = 3 }: { users: GitLabUser[]; max?: number }) {
  if (users.length === 0) return null
  const visible = users.slice(0, max)
  const extra = users.length - max
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((u) => (
        <div key={u.id} className="ring-1 ring-gray-800 rounded-full">
          <Avatar user={u} size="xs" />
        </div>
      ))}
      {extra > 0 && (
        <span className="text-xs text-gray-500 pl-2">+{extra}</span>
      )}
    </div>
  )
}

function LabelChip({ label }: { label: MRLabel }) {
  return (
    <span
      className="inline-block text-xs px-1.5 py-0.5 rounded-full leading-none font-medium truncate max-w-[120px]"
      style={{ backgroundColor: label.color, color: label.textColor }}
      title={label.name}
    >
      {label.name}
    </span>
  )
}

export default function MRCard({ mr }: MRCardProps) {
  const handleOpen = () => window.electronAPI.openUrl(mr.webUrl)

  const approvalsRequired = mr.approvalsRequired ?? 0
  const approvalsLeft = mr.approvalsLeft ?? 0
  const approvalsGiven = approvalsRequired - approvalsLeft
  const isApproved = approvalsRequired > 0 && approvalsLeft === 0
  const needsApproval = approvalsRequired > 0 && approvalsLeft > 0

  const wasUpdated = mr.updatedAt && mr.updatedAt !== mr.createdAt

  return (
    <div
      className="px-3 py-2.5 border-b border-gray-700 hover:bg-gray-750 cursor-pointer group transition-colors"
      onClick={handleOpen}
    >
      <div className="flex items-start gap-2">
        {/* Author avatar */}
        <div className="flex-shrink-0 mt-0.5">
          <Avatar user={mr.author} size="sm" />
        </div>

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
            <span className="text-xs text-gray-500">!{mr.iid}</span>
            <span className="text-gray-600 text-xs">·</span>
            <span className="text-xs text-gray-500" title={wasUpdated ? `updated ${timeAgo(mr.updatedAt)}` : undefined}>
              {wasUpdated ? `↻ ${timeAgo(mr.updatedAt)}` : timeAgo(mr.createdAt)}
            </span>
          </div>

          {/* Branch */}
          <div className="mt-0.5">
            <span className="text-xs text-gray-600 font-mono">
              {mr.sourceBranch} → {mr.targetBranch}
            </span>
          </div>

          {/* Labels */}
          {mr.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {mr.labels.map((label) => (
                <LabelChip key={label.name} label={label} />
              ))}
            </div>
          )}

          {/* Reviewers + Assignees */}
          {(mr.reviewers.length > 0 || mr.assignees.length > 0) && (
            <div className="flex items-center gap-2 mt-1">
              {mr.reviewers.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-600">reviewers</span>
                  <AvatarStack users={mr.reviewers} />
                </div>
              )}
              {mr.assignees.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-600">assignees</span>
                  <AvatarStack users={mr.assignees} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right side badges */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {/* Approvals */}
          {approvalsRequired > 0 && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                isApproved
                  ? 'bg-green-900 text-green-300'
                  : needsApproval
                  ? 'bg-yellow-900 text-yellow-300'
                  : 'bg-gray-800 text-gray-400'
              }`}
              title={`${approvalsGiven}/${approvalsRequired} approvals`}
            >
              ✓ {approvalsGiven}/{approvalsRequired}
            </span>
          )}

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
          {mr.downvotes > 0 && (
            <span className="text-xs text-red-400">👎 {mr.downvotes}</span>
          )}
          {mr.pipelineStatus && mr.pipelineStatus !== 'canceled' && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                mr.pipelineStatus === 'success'
                  ? 'bg-green-900 text-green-300'
                  : mr.pipelineStatus === 'failed'
                  ? 'bg-red-900 text-red-300'
                  : 'bg-blue-900 text-blue-300'
              }`}
              title={`Pipeline: ${mr.pipelineStatus}`}
            >
              {mr.pipelineStatus === 'success' ? '🟢 CI' : mr.pipelineStatus === 'failed' ? '🔴 CI' : '🟡 CI'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
