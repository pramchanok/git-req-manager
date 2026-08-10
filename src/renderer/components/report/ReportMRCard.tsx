import { FolderGit2, Calendar, GitPullRequest, GitMerge, CheckCircle2, XCircle, Clock } from 'lucide-react'
import type { MergeRequest } from '../../../shared/types'
import { formatDate } from '../../utils/dateFormat'

interface ReportMRCardProps {
  mr: MergeRequest
  accentClass: string
  onOpen: (mr: MergeRequest) => void
}

/** การ์ด MR ในลิสต์ของหน้า Developer Report */
export default function ReportMRCard({ mr, accentClass, onOpen }: ReportMRCardProps) {
  return (
    <div
      onClick={() => onOpen(mr)}
      className={`bg-gray-950/40 hover:bg-gray-900/80 border border-gray-800/80 hover:border-gray-700 rounded-xl p-3.5 transition-all duration-200 cursor-pointer flex flex-col gap-2.5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 group ${accentClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] text-gray-400 font-bold font-mono bg-gray-900 border border-gray-800 px-2 py-0.5 rounded-md flex-shrink-0 flex items-center gap-1">
          <GitPullRequest className="w-3 h-3 text-orange-400" />
          !{mr.iid}
        </span>
        <h3 className="text-xs font-semibold text-gray-100 group-hover:text-orange-300 transition-colors leading-relaxed flex-1 line-clamp-2">
          {mr.title}
        </h3>
        <span
          className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider flex-shrink-0 flex items-center gap-1 ${
            mr.state === 'merged'
              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
              : mr.state === 'closed'
              ? 'bg-red-950/60 text-red-400 border border-red-800/40'
              : 'bg-blue-950/60 text-blue-400 border border-blue-800/40'
          }`}
        >
          {mr.state === 'merged' ? (
            <GitMerge className="w-2.5 h-2.5 text-emerald-400" />
          ) : mr.state === 'closed' ? (
            <XCircle className="w-2.5 h-2.5 text-red-400" />
          ) : (
            <Clock className="w-2.5 h-2.5 text-blue-400" />
          )}
          {mr.state}
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium border-t border-gray-800/40 pt-2">
        <div className="flex items-center gap-1.5 min-w-0 max-w-[320px]">
          <FolderGit2 className="w-3 h-3 text-gray-500 flex-shrink-0" />
          <span className="truncate text-gray-400" title={mr.projectNamespace || 'Unknown Project'}>
            {mr.projectNamespace || 'Unknown Project'}
          </span>
        </div>
        <div className="flex items-center gap-1 text-gray-500 text-[9px] flex-shrink-0">
          <Calendar className="w-3 h-3 text-gray-500" />
          <span>{formatDate(mr.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}

