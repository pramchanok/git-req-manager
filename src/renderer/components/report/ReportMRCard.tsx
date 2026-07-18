import type { MergeRequest } from '../../../shared/types'

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
      className={`bg-gray-800/30 hover:bg-gray-800/80 border border-gray-800/60 hover:border-gray-700/80 rounded-xl p-4 transition-all duration-350 cursor-pointer flex flex-col gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 group ${accentClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-[10px] text-gray-400 font-bold font-mono bg-gray-955/40 px-2 py-0.5 rounded-md flex-shrink-0">
          !{mr.iid}
        </span>
        <h3 className="text-xs font-bold text-white group-hover:text-orange-400 transition-colors leading-relaxed flex-1 line-clamp-2">
          {mr.title}
        </h3>
        <span
          className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-md tracking-wider flex-shrink-0 ${
            mr.state === 'merged'
              ? 'bg-green-950/50 text-green-400 border border-green-900/40'
              : mr.state === 'closed'
              ? 'bg-red-950/50 text-red-400 border border-red-900/40'
              : 'bg-blue-950/50 text-blue-400 border border-blue-900/40'
          }`}
        >
          {mr.state}
        </span>
      </div>

      <div className="flex items-center justify-between mt-0.5 text-[9px] text-gray-500 font-semibold">
        <span className="bg-gray-950/20 text-gray-400 px-2 py-0.5 rounded-md truncate max-w-[280px]">
          📁 {mr.projectNamespace || 'Unknown Project'}
        </span>
        <span className="text-gray-500">
          Created: {new Date(mr.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}
