import { useState, useEffect, useMemo } from 'react'
import type { MRDiff } from '../../shared/types'
import { CustomDiffViewer } from './CustomDiffViewer'
import { buildFileTree, FileTreeNode } from '../utils/pathTree'
import { X, Folder, FileText } from 'lucide-react'

interface CommitDiffModalProps {
  projectId: number
  fromSha?: string
  toSha: string
  onClose: () => void
}

const FileTreeNodeView = ({ node, depth = 0 }: { node: FileTreeNode, depth?: number }) => {
  const [expanded, setExpanded] = useState(true)
  
  if (node.isDirectory) {
    return (
      <div>
        <div 
          className="flex items-center gap-1.5 py-1 px-2 hover:bg-white/5 cursor-pointer text-gray-300 select-none rounded"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => setExpanded(!expanded)}
        >
          <Folder className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-sm truncate">{node.name}</span>
        </div>
        {expanded && node.children.map(child => (
          <FileTreeNodeView key={child.path} node={child} depth={depth + 1} />
        ))}
      </div>
    )
  }

  return (
    <a 
      href={`#commit-diff-${node.path}`}
      className="flex items-center gap-1.5 py-1 px-2 hover:bg-white/5 cursor-pointer text-gray-400 hover:text-gray-200 select-none rounded no-underline"
      style={{ paddingLeft: `${depth * 12 + 8}px` }}
    >
      <FileText className="w-3.5 h-3.5 text-gray-500" />
      <span className="text-sm truncate">{node.name}</span>
    </a>
  )
}

export function CommitDiffModal({ projectId, fromSha, toSha, onClose }: CommitDiffModalProps) {
  const [diffs, setDiffs] = useState<MRDiff[]>([])
  const [loading, setLoading] = useState(true)
  const [diffViewMode, setDiffViewMode] = useState<'inline' | 'split'>('inline')

  useEffect(() => {
    async function loadDiffs() {
      setLoading(true)
      try {
        let result: MRDiff[] = []
        if (fromSha) {
          result = await window.electronAPI.getCompareDiffs(projectId, fromSha, toSha)
        } else {
          result = await window.electronAPI.getCommitDiffs(projectId, toSha)
        }
        setDiffs(result)
      } catch (err) {
        console.error('Failed to load commit diffs', err)
      } finally {
        setLoading(false)
      }
    }
    loadDiffs()
  }, [projectId, fromSha, toSha])

  const fileTree = useMemo(() => buildFileTree(diffs.map(d => d.newPath).filter(Boolean), new Set(), new Map()), [diffs])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-8">
      <div className="bg-[#0d1117] border border-gray-800 rounded-xl shadow-2xl w-full h-full max-w-6xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="shrink-0 h-14 border-b border-gray-800 px-4 flex items-center justify-between bg-[#161b22]">
          <div>
            <h3 className="font-semibold text-gray-200">
              {fromSha ? `Compare: ${fromSha.slice(0, 8)}...${toSha.slice(0, 8)}` : `Commit: ${toSha.slice(0, 8)}`}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-[#0d1117] p-1 rounded-lg border border-gray-800">
              <button 
                onClick={() => setDiffViewMode('inline')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${diffViewMode === 'inline' ? 'bg-[#21262d] text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
              >
                Unified
              </button>
              <button 
                onClick={() => setDiffViewMode('split')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${diffViewMode === 'split' ? 'bg-[#21262d] text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}
              >
                Split
              </button>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar */}
          <div className="w-72 shrink-0 border-r border-gray-800 bg-[#0d1117] flex flex-col overflow-y-auto p-2">
            {loading ? (
              <div className="p-4 text-center text-sm text-gray-500">Loading files...</div>
            ) : (
              fileTree.map(node => (
                <FileTreeNodeView key={node.path} node={node} />
              ))
            )}
          </div>

          {/* Diffs */}
          <div className="flex-1 overflow-y-auto bg-[#0d1117]">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-600 border-t-orange-500 mr-3" />
                Loading diffs...
              </div>
            ) : diffs.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                No changes found.
              </div>
            ) : (
              <div className="p-4 space-y-6">
                {diffs.map((d, i) => (
                  <div key={i} id={`commit-diff-${d.newPath}`}>
                    {/* File Header */}
                    <div className="bg-gray-800/50 px-4 py-2 text-sm font-mono text-gray-300 border border-gray-800 border-b-0 rounded-t-lg flex justify-between items-center">
                      <span>{d.newPath}</span>
                    </div>
                    <div className="border border-gray-800 rounded-b-lg overflow-hidden">
                      <CustomDiffViewer 
                        diffString={d.diff} 
                        viewMode={diffViewMode} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
