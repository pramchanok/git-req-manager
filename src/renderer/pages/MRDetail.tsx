import { useState, useEffect, useMemo, useRef } from 'react'
import type { GitLabUser, MergeRequest, MRDiff, MRDiscussion, MRAwardEmoji } from '../../shared/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import parseDiff from 'parse-diff'
import { CommitDiffModal } from '../components/CommitDiffModal'
import { buildFileTree } from '../utils/pathTree'
import MRHeader, { MRDetailTab } from '../components/mr-detail/MRHeader'
import FilesSidebar from '../components/mr-detail/FilesSidebar'
import DiffList from '../components/mr-detail/DiffList'
import AwardEmojiBar from '../components/mr-detail/AwardEmojiBar'
import DiscussionThread from '../components/mr-detail/DiscussionThread'
import CommentComposer from '../components/mr-detail/CommentComposer'
import MRActionBar, { MRAction } from '../components/mr-detail/MRActionBar'
import CloseConfirmModal from '../components/mr-detail/CloseConfirmModal'

import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'

interface MRDetailProps {
  projectId: number
  mrIid: number
  onBack: () => void
  onRefresh: () => void
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

export default function MRDetail({ projectId, mrIid, onBack, onRefresh, onToast }: MRDetailProps) {
  const [mr, setMR] = useState<MergeRequest | null>(null)
  const [activeTab, setActiveTab] = useState<MRDetailTab>('overview')
  const [diffs, setDiffs] = useState<MRDiff[]>([])
  const [discussions, setDiscussions] = useState<MRDiscussion[]>([])
  const [loadingDiffs, setLoadingDiffs] = useState(false)
  const [loadingDiscussions, setLoadingDiscussions] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [activeAction, setActiveAction] = useState<MRAction | null>(null)
  const [pendingEmoji, setPendingEmoji] = useState<string | null>(null)
  const [removeSourceBranch, setRemoveSourceBranch] = useState(true)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(288) // 72 * 4 = 288px default
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [diffViewMode, setDiffViewMode] = useState<'inline' | 'split'>('inline')
  const [activeCommitDiff, setActiveCommitDiff] = useState<{ fromSha?: string; toSha: string } | null>(null)
  const [awardEmojis, setAwardEmojis] = useState<MRAwardEmoji[]>([])
  const [currentUser, setCurrentUser] = useState<GitLabUser | null>(null)

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

  const fileTree = useMemo(() => {
    return buildFileTree(diffs.map(d => d.newPath), viewedFiles, diffStats)
  }, [diffs, viewedFiles, diffStats])

  const fetchDiffs = async (silent = false) => {
    if (!silent) setLoadingDiffs(true)
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

  /** โหลดตัว MR + approvals ใหม่ (ใช้ทั้งตอน mount, ตอนได้ push จาก main และตอน poll ระหว่าง pipeline วิ่ง) */
  const refreshMR = async (notifyError = false) => {
    try {
      const [mrData, appState, approvals] = await Promise.all([
        window.electronAPI.getMRByIid(projectId, mrIid),
        window.electronAPI.getAppState(),
        window.electronAPI.getMRApprovals(projectId, mrIid)
      ])

      if (mrData && appState.currentUser) {
        mrData.hasApproved = approvals.approved_by.some(a => a.user.id === appState.currentUser?.id)
      }

      setMR(mrData)
      setCurrentUser(appState.currentUser)
    } catch (err) {
      console.error(err)
      if (notifyError) onToast('Failed to load MR', 'error')
    }
  }

  useEffect(() => {
    refreshMR(true)
    fetchDiscussions()
    fetchAwardEmojis()

    // fallback poll (โหมด polling หรือกรณี webhook หลุด) — discussions/emojis ทุก 20 วินาที
    const interval = setInterval(() => {
      fetchDiscussions()
      fetchAwardEmojis()
    }, 20000)

    // real-time: main process broadcast state ใหม่ทุกครั้งที่ sync (webhook/polling) → refresh ทันที
    const unsubscribe = window.electronAPI.onAppStateUpdated(() => {
      refreshMR()
      fetchDiscussions()
      fetchAwardEmojis()
    })

    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [projectId, mrIid])

  // pipeline กำลังวิ่ง → poll ตัว MR ทุก 15 วินาที ให้ badge/ปุ่ม Merge ตามสถานะจริง
  useEffect(() => {
    if (mr?.pipelineStatus !== 'running') return
    const interval = setInterval(() => refreshMR(), 15000)
    return () => clearInterval(interval)
  }, [mr?.pipelineStatus, projectId, mrIid])

  // โหลด diffs ครั้งแรก และโหลดซ้ำแบบเงียบๆ เมื่อ head sha เปลี่ยน (มี commit ใหม่ push เข้ามา)
  const lastShaRef = useRef<string | null>(null)
  useEffect(() => {
    if (!mr) return
    if (lastShaRef.current === null) {
      lastShaRef.current = mr.sha
      fetchDiffs()
    } else if (mr.sha && mr.sha !== lastShaRef.current) {
      lastShaRef.current = mr.sha
      fetchDiffs(true)
    }
  }, [mr?.sha])

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

  const toggleAwardEmoji = async (emojiName: string) => {
    if (!currentUser) {
      onToast('User not loaded yet. Try again later.', 'error')
      return
    }

    // Normalize names from emoji picker
    if (emojiName === '+1') emojiName = 'thumbsup'
    if (emojiName === '-1') emojiName = 'thumbsdown'

    setPendingEmoji(emojiName)
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
    } finally {
      setPendingEmoji(null)
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

  const handleAction = async (action: MRAction) => {
    if (!mr) return
    setActiveAction(action)
    try {
      if (action === 'approve') {
        await window.electronAPI.approveMR(projectId, mrIid)
        onToast('MR Approved')
      } else if (action === 'unapprove') {
        await window.electronAPI.unapproveMR(projectId, mrIid)
        onToast('MR Approval Revoked')
      } else if (action === 'merge') {
        await window.electronAPI.mergeMR(projectId, mrIid, {
          mergeWhenPipelineSucceeds: mr.pipelineStatus === 'running',
          removeSourceBranch,
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
      await refreshMR()
    } catch (err) {
      console.error(err)
      onToast(`Failed to ${action} MR`, 'error')
    } finally {
      setActiveAction(null)
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
      <MRHeader
        mr={mr}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        diffsCount={diffs.length}
        cancelingPipeline={activeAction === 'cancel-pipeline'}
        onCancelPipeline={() => handleAction('cancel-pipeline')}
      />

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative flex">
        {activeTab === 'changes' && (
          <FilesSidebar
            fileTree={fileTree}
            filesCount={diffs.length}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
            width={sidebarWidth}
            onStartResize={() => setIsResizing(true)}
          />
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          <div className={`${activeTab === 'changes' ? 'w-full' : 'max-w-5xl mx-auto'} p-6 pb-20`}>
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
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                        {mr.description}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-gray-500 italic text-sm">No description provided.</p>
                  )}
                </div>

                {/* Award Emojis */}
                <AwardEmojiBar emojiGroups={emojiGroups} onToggle={toggleAwardEmoji} pendingEmoji={pendingEmoji} />

                {/* Discussion Thread */}
                <DiscussionThread
                  discussions={discussions}
                  loading={loadingDiscussions}
                  mrWebUrl={mr.webUrl}
                  onOpenCommitDiff={setActiveCommitDiff}
                />

                {/* Comment Input */}
                <CommentComposer
                  value={commentText}
                  onChange={setCommentText}
                  submitting={submittingComment}
                  onSubmit={handleAddComment}
                />
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in">
                <DiffList
                  diffs={diffs}
                  loading={loadingDiffs}
                  viewedFiles={viewedFiles}
                  onToggleViewed={toggleViewedFile}
                  diffStats={diffStats}
                  viewMode={diffViewMode}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Glassmorphic Sticky Action Bar */}
      <MRActionBar
        mr={mr}
        currentUser={currentUser}
        activeAction={activeAction}
        removeSourceBranch={removeSourceBranch}
        onRemoveSourceBranchChange={setRemoveSourceBranch}
        onBack={onBack}
        onAction={handleAction}
        onRequestClose={() => setShowCloseConfirm(true)}
      />

      {activeCommitDiff && (
        <CommitDiffModal
          projectId={projectId}
          fromSha={activeCommitDiff.fromSha}
          toSha={activeCommitDiff.toSha}
          onClose={() => setActiveCommitDiff(null)}
        />
      )}

      {/* Confirmation Modal for Close MR */}
      {showCloseConfirm && (
        <CloseConfirmModal
          onCancel={() => setShowCloseConfirm(false)}
          onConfirm={() => {
            setShowCloseConfirm(false)
            handleAction('close')
          }}
        />
      )}
    </div>
  )
}
