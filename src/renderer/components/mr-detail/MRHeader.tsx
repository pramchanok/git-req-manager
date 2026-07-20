import type { MergeRequest } from '../../../shared/types'
import { GitCommit, Folder } from 'lucide-react'
import PipelineMiniGraph from './PipelineMiniGraph'

export type MRDetailTab = 'overview' | 'changes'

interface MRHeaderProps {
  mr: MergeRequest
  activeTab: MRDetailTab
  onTabChange: (tab: MRDetailTab) => void
  diffsCount: number
  cancelingPipeline: boolean
  onCancelPipeline: () => void
}

/** Header ของหน้า MR Detail: ชื่อ MR, branch, badge สถานะ, pipeline, labels และแท็บ */
export default function MRHeader({ mr, activeTab, onTabChange, diffsCount, cancelingPipeline, onCancelPipeline }: MRHeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-[#0d1117]/80 backdrop-blur-xl border-b border-gray-800 shrink-0">
      <div className="px-6 py-5">
        <div className="flex flex-col gap-1">

          {/* Top Meta Row: Project & Author */}
          <div className="flex items-center gap-3 text-xs mb-1">
            <div className="inline-flex items-center gap-1.5 bg-[#161b22] border border-gray-700/60 px-2.5 py-1 rounded-md text-gray-300 shadow-sm">
              <Folder className="w-3.5 h-3.5 text-orange-500/80" />
              <span title={mr.projectNamespace} className="truncate max-w-[150px] opacity-60">{mr.projectNamespace}</span>
              <span className="opacity-40">/</span>
              <span className="truncate max-w-[200px] font-medium">{mr.projectName}</span>
            </div>
            <div className="w-1 h-1 bg-gray-700 rounded-full" />
            <div className="flex items-center gap-1.5 text-gray-400">
              <img src={mr.author.avatarUrl} alt={mr.author.name} className="w-4 h-4 rounded-full border border-gray-700" />
              <span className="font-medium text-gray-300">{mr.author.name}</span>
              <span className="opacity-70">requests to merge</span>
            </div>
          </div>

          {/* Title Row */}
          <div className="mb-3">
            <h1 className="text-xl font-bold text-gray-100 leading-snug m-0">
              {mr.title} <span className="text-gray-500 font-mono text-lg font-medium ml-1.5">!{mr.iid}</span>
            </h1>
          </div>

          {/* Bottom Meta Row: Branches & Badges */}
          <div className="flex items-center flex-wrap gap-3">
            {/* Branches */}
            <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-900/60 px-2.5 py-1.5 rounded-md border border-gray-800/80 shadow-sm">
              <GitCommit className="w-3.5 h-3.5 text-gray-500" />
              <span className="font-mono text-orange-300/90">{mr.sourceBranch}</span>
              <span className="text-gray-600 px-1">→</span>
              <span className="font-mono text-orange-300/90">{mr.targetBranch}</span>
            </div>

            <div className="w-[1px] h-4 bg-gray-800" />

            {/* Status Badge */}
            <div className="flex items-center gap-2 flex-wrap">
              {mr.draft && (
                <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-bold px-2.5 py-1 rounded-md tracking-wide shadow-sm">
                  DRAFT
                </span>
              )}
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-md tracking-wide shadow-sm border ${
                mr.state === 'opened' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                mr.state === 'merged' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {mr.state.toUpperCase()}
              </span>

              {/* Pipeline */}
              {mr.pipelineStatus && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => mr.pipelineWebUrl && window.electronAPI.openUrl(mr.pipelineWebUrl)}
                    title="View Pipeline on GitLab"
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 border transition-all shadow-sm ${
                      mr.pipelineStatus === 'success' ? 'text-green-400 bg-green-500/10 border-green-500/20 hover:bg-green-500/20' :
                      mr.pipelineStatus === 'failed' ? 'text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500/20' :
                      mr.pipelineStatus === 'running' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20' :
                      'text-gray-400 bg-gray-500/10 border-gray-500/20 hover:bg-gray-500/20'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      mr.pipelineStatus === 'success' ? 'bg-green-400' :
                      mr.pipelineStatus === 'failed' ? 'bg-red-400' :
                      mr.pipelineStatus === 'running' ? 'bg-blue-400 animate-pulse' :
                      'bg-gray-400'
                    }`} />
                    PIPELINE {mr.pipelineStatus.toUpperCase()}
                  </button>

                  {mr.pipelineId && (
                    <PipelineMiniGraph
                      projectId={mr.projectId}
                      pipelineId={mr.pipelineId}
                      pipelineStatus={mr.pipelineStatus}
                    />
                  )}

                  {mr.pipelineStatus === 'running' && (
                    <button
                      onClick={onCancelPipeline}
                      title="Cancel running pipeline"
                      disabled={cancelingPipeline}
                      className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md border border-gray-700 bg-gray-800 text-gray-400 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {cancelingPipeline ? (
                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      )}
                      {cancelingPipeline ? 'CANCELING…' : 'CANCEL'}
                    </button>
                  )}
                </div>
              )}

              {/* Labels */}
              {mr.labels?.length > 0 && <div className="w-[1px] h-4 bg-gray-800 mx-1" />}
              {mr.labels?.map((label, idx) => (
                <span
                  key={idx}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-gray-700/50 shadow-sm transition-transform hover:scale-105 cursor-default"
                  style={{ backgroundColor: label.color, color: label.textColor || '#fff' }}
                  title={label.name}
                >
                  {label.name}
                </span>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex px-6 gap-6 text-sm font-medium">
        <button
          className={`pb-2 border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-orange-500 text-orange-400'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
          onClick={() => onTabChange('overview')}
        >
          Overview
        </button>
        <button
          className={`pb-2 border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'changes'
              ? 'border-orange-500 text-orange-400'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
          onClick={() => onTabChange('changes')}
        >
          Changes
          <span className={`text-[10px] py-0.5 px-2 rounded-full ${
            activeTab === 'changes' ? 'bg-orange-500/20 text-orange-300' : 'bg-gray-800 text-gray-400'
          }`}>
            {diffsCount}
          </span>
        </button>
      </div>
    </header>
  )
}
