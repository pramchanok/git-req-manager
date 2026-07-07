import { useState, useEffect, useMemo } from 'react'
import type { MergeRequest, MRDiff, MRDiscussion, MRNote } from '../../shared/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import parseDiff from 'parse-diff'
import { CustomDiffViewer } from '../components/CustomDiffViewer'
import { CommitDiffModal } from '../components/CommitDiffModal'
import { buildFileTree, FileTreeNode } from '../utils/pathTree'
import { MessageSquare, User, GitCommit, Settings, Check, X, FileText, Folder, Eye } from 'lucide-react'

import { marked } from 'marked'
import MDEditor, { commands } from '@uiw/react-md-editor'
import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'
import data from '@emoji-mart/data'
import Picker from '@emoji-mart/react'

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
          <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
          <span className="text-xs truncate">{node.name}</span>
        </div>
        {expanded && node.children?.map((child, i) => (
          <FileTreeNodeView key={i} node={child} depth={depth + 1} />
        ))}
      </div>
    )
  }

  return (
    <div 
      className={`flex items-center justify-between py-1 px-2 hover:bg-white/5 cursor-pointer select-none rounded group ${node.isViewed ? 'opacity-50' : ''}`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
      onClick={() => {
        document.getElementById(`diff-${node.path}`)?.scrollIntoView({ behavior: 'smooth' })
      }}
    >
      <div className="flex items-center gap-1.5 overflow-hidden">
        <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
        <span className={`text-xs truncate ${node.isViewed ? 'line-through text-gray-500' : 'text-gray-300'}`}>{node.name}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 opacity-100 transition-opacity">
        {(node.additions ?? 0) > 0 && <span className="text-[10px] text-green-400">+{node.additions}</span>}
        {(node.deletions ?? 0) > 0 && <span className="text-[10px] text-red-400">-{node.deletions}</span>}
        {node.isViewed && <svg className="w-3 h-3 text-orange-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
      </div>
    </div>
  )
}

interface MRDetailProps {
  projectId: number
  mrIid: number
  onBack: () => void
  onRefresh: () => void
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

type Tab = 'overview' | 'changes'

export default function MRDetail({ projectId, mrIid, onBack, onRefresh, onToast }: MRDetailProps) {
  const [mr, setMR] = useState<MergeRequest | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [diffs, setDiffs] = useState<MRDiff[]>([])
  const [discussions, setDiscussions] = useState<MRDiscussion[]>([])
  const [loadingDiffs, setLoadingDiffs] = useState(false)
  const [loadingDiscussions, setLoadingDiscussions] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [processingAction, setProcessingAction] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(288) // 72 * 4 = 288px default
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [diffViewMode, setDiffViewMode] = useState<'inline' | 'split'>('inline')
  const [activeCommitDiff, setActiveCommitDiff] = useState<{ fromSha?: string; toSha: string } | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  
  const storageKey = `mr-viewed-${projectId}-${mrIid}`
  const [viewedFiles, setViewedFiles] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(Array.from(viewedFiles)))
  }, [viewedFiles, storageKey])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const newWidth = Math.max(200, Math.min(e.clientX, 600))
      setSidebarWidth(newWidth)
      if (newWidth < 220 && !sidebarCollapsed) {
        setSidebarCollapsed(true)
      } else if (newWidth >= 220 && sidebarCollapsed) {
        setSidebarCollapsed(false)
      }
    }
    const handleMouseUp = () => {
      setIsResizing(false)
    }
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, sidebarCollapsed])

  const diffStats = useMemo(() => {
    const stats = new Map<string, { additions: number; deletions: number }>()
    for (const d of diffs) {
      try {
        const parsed = parseDiff(d.diff)
        if (parsed.length > 0) {
          stats.set(d.newPath, { additions: parsed[0].additions, deletions: parsed[0].deletions })
        }
      } catch (e) {
        // ignore
      }
    }
    return stats
  }, [diffs])

  const [awardEmojis, setAwardEmojis] = useState<import('../../shared/types').MRAwardEmoji[]>([])
  const [currentUser, setCurrentUser] = useState<import('../../shared/types').GitLabUser | null>(null)

  const fileTree = useMemo(() => {
    return buildFileTree(diffs.map(d => d.newPath), viewedFiles, diffStats)
  }, [diffs, viewedFiles, diffStats])

  const fetchDiffs = async () => {
    setLoadingDiffs(true)
    try {
      const data = await window.electronAPI.getMRDiffs(projectId, mrIid)
      setDiffs(data)
    } catch (err) {
      console.error(err)
      onToast('Failed to load diffs', 'error')
    } finally {
      setLoadingDiffs(false)
    }
  }

  const fetchDiscussions = async () => {
    setLoadingDiscussions(true)
    try {
      const data = await window.electronAPI.getMRDiscussions(projectId, mrIid)
      setDiscussions(data)
    } catch (err) {
      console.error(err)
      onToast('Failed to load discussions', 'error')
    } finally {
      setLoadingDiscussions(false)
    }
  }

  const fetchAwardEmojis = async () => {
    try {
      const data = await window.electronAPI.getMRAwardEmojis(projectId, mrIid)
      setAwardEmojis(data)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        const [mrData, appState] = await Promise.all([
          window.electronAPI.getMRByIid(projectId, mrIid),
          window.electronAPI.getAppState()
        ])
        setMR(mrData)
        setCurrentUser(appState.currentUser)
      } catch (err) {
        console.error(err)
        onToast('Failed to load MR', 'error')
      }
    }
    loadData()
    fetchDiscussions()
    fetchDiffs()
    fetchAwardEmojis()
    
    const interval = setInterval(() => {
      fetchDiscussions()
      fetchAwardEmojis()
    }, 60000)
    return () => clearInterval(interval)
  }, [projectId, mrIid])

  const handleAddComment = async () => {
    if (!commentText.trim()) return
    setSubmittingComment(true)
    try {
      await window.electronAPI.addMRNote(projectId, mrIid, commentText)
      setCommentText('')
      await fetchDiscussions()
      onToast('Comment added')
    } catch (err) {
      console.error(err)
      onToast('Failed to add comment', 'error')
    } finally {
      setSubmittingComment(false)
    }
  }

  const getEmojiChar = (name: string) => {
    if (name === 'thumbsup' || name === '+1') return '👍'
    if (name === 'thumbsdown' || name === '-1') return '👎'
    try {
      const emojiData = (data as any).emojis[name]
      if (emojiData && emojiData.skins && emojiData.skins[0]) {
        return emojiData.skins[0].native
      }
      for (const key of Object.keys((data as any).emojis || {})) {
        const e = (data as any).emojis[key]
        if (e.id === name || (e.shortcodes && e.shortcodes.includes(`:${name}:`))) {
          return e.skins[0].native
        }
      }
    } catch (e) {}
    return `:${name}:`
  }

  const toggleAwardEmoji = async (emojiName: string) => {
    if (!currentUser) {
      onToast('User not loaded yet. Try again later.', 'error')
      return
    }
    
    // Normalize names from emoji picker
    if (emojiName === '+1') emojiName = 'thumbsup'
    if (emojiName === '-1') emojiName = 'thumbsdown'

    try {
      const existing = awardEmojis.find(a => a.name === emojiName && a.user.id === currentUser.id)
      
      if (!existing && (emojiName === 'thumbsup' || emojiName === 'thumbsdown')) {
        const oppositeName = emojiName === 'thumbsup' ? 'thumbsdown' : 'thumbsup'
        const oppositeExisting = awardEmojis.find(a => a.name === oppositeName && a.user.id === currentUser.id)
        if (oppositeExisting) {
          await window.electronAPI.removeMRAwardEmoji(projectId, mrIid, oppositeExisting.id)
        }
      }

      if (existing) {
        await window.electronAPI.removeMRAwardEmoji(projectId, mrIid, existing.id)
      } else {
        await window.electronAPI.addMRAwardEmoji(projectId, mrIid, emojiName)
      }
      await fetchAwardEmojis()
    } catch (err) {
      console.error(err)
      onToast('Failed to update reaction', 'error')
    }
  }

  const emojiGroups = useMemo(() => {
    const groups: Record<string, { count: number, hasVoted: boolean }> = {}
    for (const a of awardEmojis) {
      if (!groups[a.name]) groups[a.name] = { count: 0, hasVoted: false }
      groups[a.name].count++
      if (currentUser && a.user.id === currentUser.id) {
        groups[a.name].hasVoted = true
      }
    }
    return groups
  }, [awardEmojis, currentUser])

  const handleAction = async (action: 'approve' | 'merge' | 'close' | 'cancel-pipeline') => {
    setProcessingAction(true)
    try {
      if (action === 'approve') {
        await window.electronAPI.approveMR(projectId, mrIid)
        onToast('MR Approved')
      } else if (action === 'merge') {
        await window.electronAPI.mergeMR(projectId, mrIid, {
          mergeWhenPipelineSucceeds: mr.pipelineStatus === 'running'
        })
        onToast(mr.pipelineStatus === 'running' ? 'Auto-Merge Set' : 'MR Merged')
      } else if (action === 'close') {
        await window.electronAPI.closeMR(projectId, mrIid)
        onToast('MR Closed')
      } else if (action === 'cancel-pipeline') {
        if (mr.pipelineId) {
          await window.electronAPI.cancelPipeline(projectId, mr.pipelineId)
          onToast('Pipeline Canceled')
        }
      }
      onRefresh()
      // Note: we don't close the window on approve, just refresh so user can see it approved.
      // If merged or closed, it might make sense to close the window, but we leave it to the user.
      const updatedMR = await window.electronAPI.getMRByIid(projectId, mrIid)
      setMR(updatedMR)
    } catch (err) {
      console.error(err)
      onToast(`Failed to ${action} MR`, 'error')
    } finally {
      setProcessingAction(false)
    }
  }

  const toggleViewedFile = (filePath: string) => {
    setViewedFiles(prev => {
      const next = new Set(prev)
      if (next.has(filePath)) next.delete(filePath)
      else next.add(filePath)
      return next
    })
  }

  if (!mr) {
    return (
      <div className="flex flex-col h-screen bg-[#0d1117] items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-gray-400 text-sm font-medium">Loading Merge Request...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#0d1117] text-gray-200 font-sans selection:bg-orange-500/30 selection:text-orange-200">
      {/* Glassmorphic Header */}
      <header className="sticky top-0 z-20 bg-[#0d1117]/80 backdrop-blur-xl border-b border-gray-800 shrink-0">
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-gray-500 font-mono text-sm">!{mr.iid}</span>
                {mr.draft && (
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold px-2 py-0.5 rounded-full">
                    DRAFT
                  </span>
                )}
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                  mr.state === 'opened' 
                    ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                    : mr.state === 'merged'
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {mr.state.toUpperCase()}
                </span>
                {mr.pipelineStatus && (
                  <div className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5 border ${
                    mr.pipelineStatus === 'success' ? 'text-green-400 bg-green-500/10 border-green-500/20' :
                    mr.pipelineStatus === 'failed' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                    mr.pipelineStatus === 'running' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' :
                    'text-gray-400 bg-gray-500/10 border-gray-500/20'
                  }`}>
                    <span 
                      className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => mr.pipelineWebUrl && window.electronAPI.openUrl(mr.pipelineWebUrl)}
                      title={mr.pipelineWebUrl ? 'View pipeline in browser' : ''}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        mr.pipelineStatus === 'success' ? 'bg-green-400' :
                        mr.pipelineStatus === 'failed' ? 'bg-red-400' :
                        mr.pipelineStatus === 'running' ? 'bg-blue-400 animate-pulse' :
                        'bg-gray-400'
                      }`} />
                      Pipeline {mr.pipelineStatus}
                    </span>
                    {mr.pipelineStatus === 'running' && (
                      <button 
                        onClick={() => handleAction('cancel-pipeline')}
                        className="ml-1 text-blue-400/60 hover:text-red-400 hover:bg-red-400/20 rounded p-0.5 transition-colors"
                        title="Cancel Pipeline"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <h1 className="text-xl font-bold text-gray-100 leading-tight mb-3">
                {mr.title}
              </h1>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <img src={mr.author.avatarUrl} alt={mr.author.name} className="w-5 h-5 rounded-full border border-gray-700" />
                  <span className="font-medium text-gray-300">{mr.author.name}</span>
                </div>
                <span>requests to merge</span>
                <span className="font-mono bg-gray-800/60 text-orange-300 px-2 py-0.5 rounded text-xs border border-gray-700/50">{mr.sourceBranch}</span>
                <span>into</span>
                <span className="font-mono bg-gray-800/60 text-orange-300 px-2 py-0.5 rounded text-xs border border-gray-700/50">{mr.targetBranch}</span>
              </div>
              <div className="flex items-center gap-3">
                {mr.state === 'opened' && (
                  <button
                    onClick={() => handleAction('close')}
                    disabled={processingAction}
                    className="text-gray-500 hover:text-red-400 text-xs font-semibold px-3 py-1.5 rounded-lg border border-transparent hover:border-red-500/30 hover:bg-red-500/10 transition-colors"
                  >
                    Close MR
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-6 gap-6 text-sm font-medium">
          <button
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'overview' 
                ? 'border-orange-500 text-orange-400' 
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'changes' 
                ? 'border-orange-500 text-orange-400' 
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('changes')}
          >
            Changes 
            <span className={`text-[10px] py-0.5 px-2 rounded-full ${
              activeTab === 'changes' ? 'bg-orange-500/20 text-orange-300' : 'bg-gray-800 text-gray-400'
            }`}>
              {diffs.length}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex">
        {activeTab === 'changes' && (
          <div 
            className={`shrink-0 border-r border-gray-800 bg-[#0d1117] flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-12' : ''}`}
            style={{ width: sidebarCollapsed ? undefined : sidebarWidth }}
          >
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              {!sidebarCollapsed && <span className="text-xs font-semibold text-gray-400">Files</span>}
              <div className="flex items-center gap-2">
                {!sidebarCollapsed && <span className="text-xs text-gray-500">{diffs.length}</span>}
                <button 
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded hover:bg-gray-800"
                  title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarCollapsed ? "M13 5l7 7-7 7M5 5l7 7-7 7" : "M11 19l-7-7 7-7m8 14l-7-7 7-7"} />
                  </svg>
                </button>
              </div>
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {fileTree.map((node, i) => (
                  <FileTreeNodeView key={i} node={node} />
                ))}
              </div>
            )}
            
            {/* Resizer Handle */}
            {!sidebarCollapsed && (
              <div 
                className="absolute top-0 bottom-0 right-0 w-1 cursor-col-resize hover:bg-orange-500/50 active:bg-orange-500 z-10 transition-colors"
                style={{ left: sidebarWidth - 2 }}
                onMouseDown={() => setIsResizing(true)}
              />
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          <div className={`${activeTab === 'changes' ? 'w-full' : 'max-w-5xl mx-auto'} p-6 pb-32`}>
            {activeTab === 'changes' && (
              <div className="mb-4 flex justify-end">
                <div className="flex items-center bg-[#161b22] border border-gray-800 rounded-lg p-1">
                  <button
                    onClick={() => setDiffViewMode('inline')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${diffViewMode === 'inline' ? 'bg-gray-800 text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Inline
                  </button>
                  <button
                    onClick={() => setDiffViewMode('split')}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${diffViewMode === 'split' ? 'bg-gray-800 text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                    Split
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'overview' ? (
            <div className="space-y-8 animate-fade-in">
              {/* Description Box */}
              <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-widest flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                  Description
                </h3>
                {mr.description ? (
                  <div className="prose prose-invert prose-orange max-w-none text-sm text-gray-300 leading-relaxed marker:text-orange-500 prose-a:text-orange-400 hover:prose-a:text-orange-300 prose-code:text-orange-200 prose-code:bg-gray-800/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-gray-800">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {mr.description}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-gray-500 italic text-sm">No description provided.</p>
                )}
              </div>

              {/* Award Emojis */}
              <div className="flex flex-wrap items-center gap-2 mt-4 relative">
                {['thumbsup', 'thumbsdown', ...Object.keys(emojiGroups).filter(name => name !== 'thumbsup' && name !== 'thumbsdown')].map(name => {
                  const group = emojiGroups[name]
                  if (!group && (name !== 'thumbsup' && name !== 'thumbsdown')) return null
                  const count = group?.count || 0
                  const hasVoted = group?.hasVoted || false
                  if (count === 0 && name !== 'thumbsup' && name !== 'thumbsdown') return null

                  const nativeChar = getEmojiChar(name)

                  return (
                    <button
                      key={name}
                      onClick={() => toggleAwardEmoji(name)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors border ${hasVoted ? 'bg-[#1d4ed8]/20 border-[#1d4ed8] text-blue-400' : 'bg-[#21262d] border-transparent text-gray-400 hover:bg-[#30363d]'}`}
                    >
                      <span className="text-base leading-none">{nativeChar}</span>
                      <span>{count}</span>
                    </button>
                  )
                })}
                
                <button
                  onClick={() => setShowReactionPicker(!showReactionPicker)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#21262d] border border-transparent text-gray-400 hover:bg-[#30363d] transition-colors"
                  title="Add reaction"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                {showReactionPicker && (
                  <div className="absolute top-10 left-0 z-50 shadow-2xl border border-gray-700 rounded-lg overflow-hidden">
                    <Picker 
                      data={data} 
                      theme="dark"
                      onEmojiSelect={(emoji: any) => {
                        toggleAwardEmoji(emoji.id)
                        setShowReactionPicker(false)
                      }}
                      onClickOutside={() => setShowReactionPicker(false)}
                    />
                  </div>
                )}
              </div>

              {/* Discussion Thread */}
              <div>
                <h3 className="text-xs font-bold text-gray-500 mb-6 uppercase tracking-widest flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                  Activity & Discussions
                </h3>
                
                {loadingDiscussions ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : discussions.length === 0 ? (
                  <div className="text-center py-12 bg-[#161b22] border border-gray-800 border-dashed rounded-xl">
                    <p className="text-gray-500 text-sm">No discussions yet. Be the first to comment!</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {discussions.map(d => (
                      <div key={d.id} className="relative group">
                        {d.notes.length > 1 && (
                          <div className="absolute top-10 bottom-4 left-5 w-[2px] bg-gray-800 rounded-full" />
                        )}
                        <div className="space-y-4">
                          {d.notes.map((note: MRNote, index: number) => {
                            if (note.system) {
                              return (
                                <div key={note.id} className={`flex items-center gap-3 relative z-10 py-1 ${index > 0 ? 'ml-12' : 'ml-2'}`}>
                                  <div className="w-6 h-6 rounded-full bg-gray-800/50 flex items-center justify-center border border-gray-700/50 shrink-0">
                                    <GitCommit className="w-3 h-3 text-gray-500" />
                                  </div>
                                  <div className="flex-1 flex flex-col gap-1 text-sm text-gray-400">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-gray-300">{note.author.name}</span>
                                      <span className="text-xs text-gray-600 ml-auto">{new Date(note.createdAt).toLocaleString()}</span>
                                    </div>
                                    <div 
                                      className="prose prose-invert prose-sm max-w-none prose-p:my-0 [&_a]:inline-flex [&_a]:items-center [&_a]:gap-1 [&_a]:bg-[#21262d] [&_a]:border [&_a]:border-gray-700 hover:[&_a]:border-gray-500 [&_a]:text-gray-200 [&_a]:px-3 [&_a]:py-1.5 [&_a]:rounded-md [&_a]:text-[12px] [&_a]:font-semibold hover:[&_a]:bg-[#30363d] [&_a]:no-underline [&_a]:transition-colors [&_a]:shadow-sm [&_a]:cursor-pointer [&_ul]:my-2 [&_ul]:list-none [&_ul]:pl-0 [&_li]:my-1.5 [&_li]:bg-[#161b22] [&_li]:border [&_li]:border-gray-800 [&_li]:rounded-lg [&_li]:px-3 [&_li]:py-2.5 [&_li]:text-gray-300 [&_li]:font-mono [&_li]:text-[13px] [&_li]:shadow-sm"
                                      dangerouslySetInnerHTML={{ __html: marked(note.body) }}
                                      onClick={(e) => {
                                        const target = e.target as HTMLElement;
                                        if (target.tagName === 'A') {
                                          e.preventDefault();
                                          const href = target.getAttribute('href');
                                          if (href) {
                                            if (href.includes('/diffs?')) {
                                              const hashes = Array.from(note.body.matchAll(/[a-f0-9]{8,40}/gi)).map(m => m[0]);
                                              const urlStartShaMatch = href.match(/start_sha=([a-f0-9]+)/i);
                                              const startSha = urlStartShaMatch ? urlStartShaMatch[1] : undefined;
                                              const commitHashes = hashes.filter(h => h.length >= 8 && h !== startSha && !/^\d+$/.test(h));

                                              if (commitHashes.length >= 2) {
                                                setActiveCommitDiff({ fromSha: commitHashes[0], toSha: commitHashes[commitHashes.length - 1] });
                                                return;
                                              } else if (commitHashes.length === 1) {
                                                setActiveCommitDiff({ toSha: commitHashes[0] });
                                                return;
                                              }
                                            }
                                            let fullUrl = href;
                                            if (href.startsWith('/')) {
                                              try {
                                                const origin = new URL(mr.webUrl).origin;
                                                fullUrl = origin + href;
                                              } catch {}
                                            }
                                            window.electronAPI.openUrl(fullUrl);
                                          }
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              )
                            }
                            return (
                              <div key={note.id} className={`flex gap-4 relative z-10 ${index > 0 ? 'ml-12' : ''}`}>
                                <img 
                                  src={note.author.avatarUrl} 
                                  alt={note.author.name} 
                                  className={`rounded-full bg-gray-800 border border-gray-700 object-cover ${index === 0 ? 'w-10 h-10' : 'w-8 h-8 mt-1'}`}
                                />
                                <div className="flex-1 bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden transition-colors hover:border-gray-700 shadow-sm">
                                  <div className="bg-gray-800/30 px-4 py-2 border-b border-gray-800 flex items-center justify-between">
                                    <span className="font-semibold text-gray-200 text-sm">{note.author.name}</span>
                                    <span className="text-gray-500 text-xs">{new Date(note.createdAt).toLocaleString()}</span>
                                  </div>
                                  <div className="px-4 py-3 text-sm text-gray-300 prose prose-invert prose-orange max-w-none prose-a:text-orange-400 hover:prose-a:text-orange-300 prose-code:text-orange-200 prose-code:bg-gray-800/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-gray-800">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.body}</ReactMarkdown>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comment Input */}
              <div className="mt-8 flex gap-4">
                <div className="flex-1 rounded-xl overflow-visible transition-colors relative">
                  <div data-color-mode="dark" className="border border-gray-700 rounded-t-xl overflow-hidden">
                    <MDEditor
                      value={commentText}
                      onChange={val => setCommentText(val || '')}
                      preview="edit"
                      height={200}
                      className="!bg-[#161b22] !border-0"
                      textareaProps={{
                        placeholder: "Write your thoughts...",
                      }}
                      commands={[
                        ...commands.getCommands(),
                        commands.divider,
                        {
                          name: 'emoji',
                          keyCommand: 'emoji',
                          buttonProps: { 'aria-label': 'Insert emoji', title: 'Insert emoji' },
                          icon: (
                            <svg width="14" height="14" viewBox="0 0 20 20">
                              <path d="M10 20a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-3-9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-3 6a4 4 0 0 1-3.46-2h6.92A4 4 0 0 1 10 15z" fill="currentColor"/>
                            </svg>
                          ),
                          execute: () => {
                            setShowEmojiPicker(prev => !prev)
                          }
                        }
                      ]}
                    />
                  </div>
                  
                  {showEmojiPicker && (
                    <div className="absolute top-10 right-0 z-50 shadow-2xl border border-gray-700 rounded-lg overflow-hidden">
                      <Picker 
                        data={data} 
                        theme="dark"
                        onEmojiSelect={(emoji: any) => {
                          setCommentText(prev => prev + emoji.native)
                          setShowEmojiPicker(false)
                        }}
                        onClickOutside={() => setShowEmojiPicker(false)}
                      />
                    </div>
                  )}

                  <div className="bg-[#161b22] px-4 py-3 border border-t-0 border-gray-700 rounded-b-xl flex justify-between items-center">
                    <span className="text-xs text-gray-500">Supports Markdown</span>
                    <button
                      onClick={handleAddComment}
                      disabled={!commentText.trim() || submittingComment}
                      className="bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold py-1.5 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(234,88,12,0.2)] hover:shadow-[0_0_20px_rgba(234,88,12,0.4)]"
                    >
                      {submittingComment ? 'Posting...' : 'Comment'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fade-in">
              {loadingDiffs ? (
                 <div className="flex justify-center py-12">
                   <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                 </div>
              ) : diffs.length === 0 ? (
                <div className="text-center py-12 bg-[#161b22] border border-gray-800 border-dashed rounded-xl">
                  <p className="text-gray-500 text-sm">No changes found in this merge request.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {diffs.map((diff, index) => {
                    const isViewed = viewedFiles.has(diff.newPath)
                    const stats = diffStats.get(diff.newPath)
                    return (
                    <div id={`diff-${diff.newPath}`} key={index} className={`bg-[#161b22] border ${isViewed ? 'border-gray-800/40 opacity-70' : 'border-gray-800'} rounded-xl overflow-hidden shadow-sm transition-all`}>
                      {/* File Header */}
                      <div className="bg-gray-800/50 px-4 py-2 text-sm font-mono text-gray-300 border-b border-gray-800 flex justify-between items-center group">
                        <div className="flex items-center gap-3">
                          <svg className="w-4 h-4 text-gray-500 group-hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          <span className={isViewed ? 'line-through text-gray-500' : ''}>{diff.newPath}</span>
                          {stats && (
                            <span className="flex items-center gap-1.5 ml-2">
                              {stats.additions > 0 && <span className="text-[10px] text-green-400 font-bold">+{stats.additions}</span>}
                              {stats.deletions > 0 && <span className="text-[10px] text-red-400 font-bold">-{stats.deletions}</span>}
                            </span>
                          )}
                          {diff.newFile && <span className="bg-green-500/10 text-green-400 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold border border-green-500/20">New</span>}
                          {diff.deletedFile && <span className="bg-red-500/10 text-red-400 text-[10px] px-2 py-0.5 rounded-full uppercase font-bold border border-red-500/20">Deleted</span>}
                        </div>
                        <label className="flex items-center gap-2 text-xs font-sans text-gray-400 hover:text-gray-200 cursor-pointer select-none">
                          Viewed
                          <input 
                            type="checkbox" 
                            checked={isViewed}
                            onChange={() => toggleViewedFile(diff.newPath)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-orange-500 focus:ring-orange-500/50 cursor-pointer" 
                          />
                        </label>
                      </div>
                      {/* Diff Viewer Wrapper */}
                      {!isViewed && (
                        <CustomDiffViewer diffString={diff.diff} viewMode={diffViewMode} />
                      )}
                    </div>
                  )
                })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

      {/* Glassmorphic Sticky Action Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-[#0d1117]/80 backdrop-blur-xl border-t border-gray-800 p-4 z-30 shadow-[0_-20px_40px_-20px_rgba(0,0,0,0.5)]">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <button
              onClick={onBack}
              className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
            >
              Close Window
            </button>
            <div className="h-4 w-px bg-gray-700" />
            <button
              onClick={() => window.electronAPI.openUrl(mr.webUrl)}
              className="text-orange-400 hover:text-orange-300 text-sm font-medium flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              View on GitLab
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            {mr.state === 'opened' && (
              <>
                <button
                  onClick={() => handleAction('approve')}
                  disabled={processingAction}
                  className="bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/30 text-sm font-semibold py-2 px-5 rounded-lg transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Approve
                </button>
                
                <button
                  onClick={() => handleAction('merge')}
                  disabled={processingAction || mr.hasConflicts || mr.pipelineStatus === 'failed'}
                  className={`text-white text-sm font-semibold py-2 px-6 rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] disabled:opacity-50 disabled:shadow-none disabled:bg-gray-700 disabled:text-gray-400 flex items-center gap-2 border border-transparent disabled:border-gray-600 ${
                    mr.pipelineStatus === 'running' ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                  title={mr.hasConflicts ? 'Has conflicts' : mr.pipelineStatus === 'failed' ? 'Pipeline failed' : mr.pipelineStatus === 'running' ? 'Merge when pipeline succeeds' : 'Merge'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                  {mr.pipelineStatus === 'running' ? 'Auto-Merge' : 'Merge'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      {activeCommitDiff && (
        <CommitDiffModal
          projectId={projectId}
          fromSha={activeCommitDiff.fromSha}
          toSha={activeCommitDiff.toSha}
          onClose={() => setActiveCommitDiff(null)}
        />
      )}
    </div>
  )
}
