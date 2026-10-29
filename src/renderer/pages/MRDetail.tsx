import { useState, useEffect, useMemo, useRef } from 'react'
import type { GitLabUser, MergeRequest, MRDiff, MRDiscussion, MRAwardEmoji } from '../../shared/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import parseDiff from 'parse-diff'
import { CommitDiffModal } from '../components/CommitDiffModal'
import { buildFileTree, getFilePathsInTreeOrder } from '../utils/pathTree'
import { extractFileDiffFromRaw } from '../../shared/diffUtils'
import MRHeader, { MRDetailTab } from '../components/mr-detail/MRHeader'
import FilesSidebar from '../components/mr-detail/FilesSidebar'
import DiffList from '../components/mr-detail/DiffList'
import AwardEmojiBar from '../components/mr-detail/AwardEmojiBar'
import DiscussionThread from '../components/mr-detail/DiscussionThread'
import CommentComposer from '../components/mr-detail/CommentComposer'
import MRActionBar, { MRAction } from '../components/mr-detail/MRActionBar'
import CloseConfirmModal from '../components/mr-detail/CloseConfirmModal'
import { AlertTriangle, ExternalLink } from 'lucide-react'

import { createRefreshQueue, mrStorageScope } from '../utils/mrWorkspace'
import { createMarkdownComponents } from '../utils/safeMarkdown'

interface MRDetailProps {
  projectId: number
  mrIid: number
  onBack: () => void
  onRefresh: () => void
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void
}

function MRDetailContent({ projectId, mrIid, onBack, onRefresh, onToast }: MRDetailProps) {
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
  const [copiedPath, setCopiedPath] = useState<string | null>(null)
  const [openingPath, setOpeningPath] = useState<string | null>(null)
  const [rawDiff, setRawDiff] = useState<string | null>(null)
  const [loadingDiffPaths, setLoadingDiffPaths] = useState<Set<string>>(new Set())
  // mrRef ต้องประกาศก่อน effect ที่อ่านค่ามัน (effect ตอน mount ใช้เทียบ MR ตัวปัจจุบัน)
  const mrRef = useRef<MergeRequest | null>(null)
  const lastShaRef = useRef<string | null>(null)
  const sidebarElementRef = useRef<HTMLDivElement>(null)
  const resizerElementRef = useRef<HTMLDivElement>(null)
  const resizeFrameRef = useRef<number | null>(null)
  const pendingSidebarWidthRef = useRef<number | null>(null)
  const resizeStartXRef = useRef(0)
  const resizeStartWidthRef = useRef(sidebarWidth)
  const displayedSidebarWidthRef = useRef(sidebarWidth)
  const lastLiveResizeAtRef = useRef(0)


  const refreshQueue = useRef(createRefreshQueue())
  const alive = useRef(true)
  const [storageKey, setStorageKey] = useState<string | null>(null)
  const [draftStatus, setDraftStatus] = useState('Loading saved draft…')
  const [draftReady, setDraftReady] = useState(false)
  const [viewedFiles, setViewedFiles] = useState<Set<string>>(new Set())
  const [reviewHead, setReviewHead] = useState<string | null>(null)
  const [resumePosition, setResumePosition] = useState<{ path: string; offset: number } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastPositionSave = useRef(0)
  const scopeRef = useRef<string | null>(null)
  const viewedRef = useRef(viewedFiles)
  viewedRef.current = viewedFiles
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    let canceled = false
    if (!currentUser) return
    setDraftReady(false)
    window.electronAPI.getSettings().then(settings => {
      if (canceled) return
      const key = mrStorageScope(settings.gitlabUrl, currentUser.id, projectId, mrIid)
      if (scopeRef.current === key) { setDraftReady(true); return }
      scopeRef.current = key
      setStorageKey(key)
      setCommentText('')
      setViewedFiles(new Set())
      setReviewHead(null)
      setResumePosition(null)
      try {
        setCommentText(localStorage.getItem(key + ':draft') || '')
        const review = JSON.parse(localStorage.getItem(key + ':review') || 'null')
        if (review && Date.now() - review.savedAt < 30 * 86400000) {
          setViewedFiles(new Set(Array.isArray(review.paths) ? review.paths.filter((p: unknown) => typeof p === 'string') : []))
          setReviewHead(typeof review.head === 'string' ? review.head : null)
          if (typeof review.position?.path === 'string' && Number.isFinite(review.position?.offset)) setResumePosition(review.position)
        }
        setDraftStatus('Drafts saved on this device')
      } catch { setDraftStatus('Draft storage unavailable') }
      setDraftReady(true)
    }).catch(() => { if (!canceled) { setDraftStatus('Draft storage unavailable'); setDraftReady(true) } })
    return () => { canceled = true }
  }, [currentUser?.id, projectId, mrIid])

  const changeComment = (text: string) => {
    setCommentText(text)
    if (!storageKey) return
    try {
      if (text) localStorage.setItem(storageKey + ':draft', text)
      else localStorage.removeItem(storageKey + ':draft')
      setDraftStatus(text ? 'Draft saved on this device' : 'Drafts saved on this device')
    } catch { setDraftStatus('Draft storage unavailable') }
  }
  const changedSinceReview = Boolean(reviewHead && mr?.sha && reviewHead !== mr.sha)
  const effectiveViewed = changedSinceReview ? new Set<string>() : viewedFiles
  const saveReview = (paths: Set<string>, head: string | null, position = resumePosition) => {
    if (!storageKey) return
    try { localStorage.setItem(storageKey + ':review', JSON.stringify({ paths: [...paths], head, position, savedAt: Date.now() })) } catch { /* Optional local persistence. */ }
  }
  const rememberPosition = () => {
    if (activeTab !== 'changes' || !scrollRef.current || Date.now() - lastPositionSave.current < 300) return
    lastPositionSave.current = Date.now()
    const top = scrollRef.current.getBoundingClientRect().top
    const cards = [...scrollRef.current.querySelectorAll<HTMLElement>('.diff-file-card')]
    const card = cards.find(item => item.getBoundingClientRect().bottom > top)
    if (!card) return
    const position = { path: card.id.slice(5), offset: top - card.getBoundingClientRect().top }
    setResumePosition(position)
    saveReview(viewedRef.current, reviewHead, position)
  }
  useEffect(() => {
    const applyPendingSidebarWidth = (persist: boolean) => {
      const pendingWidth = pendingSidebarWidthRef.current
      if (pendingWidth === null) return

      if (resizerElementRef.current) {
        const now = performance.now()
        const shouldUpdateSidebar = persist || now - lastLiveResizeAtRef.current >= 50

        if (shouldUpdateSidebar) {
          if (sidebarElementRef.current) {
            sidebarElementRef.current.style.width = `${pendingWidth}px`
          }
          displayedSidebarWidthRef.current = pendingWidth
          lastLiveResizeAtRef.current = now
          resizerElementRef.current.style.transform = ''
        } else {
          const delta = pendingWidth - displayedSidebarWidthRef.current
          resizerElementRef.current.style.transform = `translateX(${delta}px)`
        }
      }
      if (persist) setSidebarWidth(pendingWidth)
      if (persist) pendingSidebarWidthRef.current = null
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const newWidth = Math.max(200, Math.min(resizeStartWidthRef.current + e.clientX - resizeStartXRef.current, 600))
      pendingSidebarWidthRef.current = newWidth

      if (resizeFrameRef.current !== null) return
      resizeFrameRef.current = window.requestAnimationFrame(() => {
        resizeFrameRef.current = null
        applyPendingSidebarWidth(false)
      })
    }
    const handleMouseUp = () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
        resizeFrameRef.current = null
      }
      applyPendingSidebarWidth(true)
      setIsResizing(false)
    }
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current)
        resizeFrameRef.current = null
      }
      if (resizerElementRef.current) resizerElementRef.current.style.transform = ''
      pendingSidebarWidthRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing])

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
    return buildFileTree(diffs.map(d => d.newPath), changedSinceReview ? new Set() : viewedFiles, diffStats)
  }, [diffs, viewedFiles, diffStats, changedSinceReview])

  const orderedDiffs = useMemo(() => {
    const diffsByPath = new Map(diffs.map(diff => [diff.newPath, diff]))
    return getFilePathsInTreeOrder(fileTree)
      .map(path => diffsByPath.get(path))
      .filter((diff): diff is MRDiff => diff !== undefined)
  }, [diffs, fileTree])

  const fetchDiffs = (silent = false) => refreshQueue.current("fetchDiffs", async () => {
    if (!alive.current) return
    if (!silent) setLoadingDiffs(true)
    setRawDiff(null)
    try {
      const data = await window.electronAPI.getMRDiffs(projectId, mrIid)
      if (alive.current) setDiffs(data)
    } catch (err) {
      console.error(err)
      onToast('Failed to load diffs', 'error')
    } finally {
      setLoadingDiffs(false)
    }
  })

  const handleLoadDiff = async (filePath: string) => {
    setLoadingDiffPaths((prev) => new Set(prev).add(filePath))
    try {
      let currentRawDiff = rawDiff
      if (currentRawDiff === null) {
        currentRawDiff = await window.electronAPI.getMRRawDiff(projectId, mrIid)
        setRawDiff(currentRawDiff)
      }
      const extracted = extractFileDiffFromRaw(currentRawDiff, filePath)
      if (extracted) {
        setDiffs((prevDiffs) =>
          prevDiffs.map((d) => {
            const path = d.newPath && d.newPath !== '/dev/null' ? d.newPath : d.oldPath
            if (path === filePath) {
              return { ...d, diff: extracted, collapsed: false }
            }
            return d
          })
        )
      } else {
        onToast('Diff content is empty for this file.', 'info')
      }
    } catch (err) {
      console.error(err)
      onToast('Failed to load diff', 'error')
    } finally {
      setLoadingDiffPaths((prev) => {
        const next = new Set(prev)
        next.delete(filePath)
        return next
      })
    }
  }

  const fetchDiscussions = (silent = false) => refreshQueue.current("fetchDiscussions", async () => {
    if (!alive.current) return
    if (!silent) setLoadingDiscussions(true)
    try {
      const data = await window.electronAPI.getMRDiscussions(projectId, mrIid)
      if (alive.current) setDiscussions(data)
    } catch (err) {
      console.error(err)
      if (!silent) onToast('Failed to load discussions', 'error')
    } finally {
      setLoadingDiscussions(false)
    }
  })

  const fetchAwardEmojis = () => refreshQueue.current("fetchAwardEmojis", async () => {
    if (!alive.current) return
    try {
      const data = await window.electronAPI.getMRAwardEmojis(projectId, mrIid)
      if (alive.current) setAwardEmojis(data)
    } catch (err) {
      console.error(err)
    }
  })

  /** โหลดตัว MR + approvals ใหม่ (ใช้ทั้งตอน mount, ตอนได้ push จาก main และตอน poll ระหว่าง pipeline วิ่ง) */
  const refreshMR = (notifyError = false) => refreshQueue.current("refreshMR", async () => {
    if (!alive.current) return
    try {
      const [mrData, appState, approvals] = await Promise.all([
        window.electronAPI.getMRByIid(projectId, mrIid),
        window.electronAPI.getAppState(),
        window.electronAPI.getMRApprovals(projectId, mrIid)
      ])

      if (mrData && appState.currentUser) {
        mrData.hasApproved = approvals.approved_by.some((a: { user: GitLabUser }) => a.user.id === appState.currentUser?.id)
      }

      if (!alive.current) return
      setMR(mrData)
      setCurrentUser(appState.currentUser)
    } catch (err) {
      console.error(err)
      if (notifyError) onToast('Failed to load MR', 'error')
    }
  })

  useEffect(() => {
    refreshMR(true)
    fetchDiscussions()
    fetchAwardEmojis()

    // fallback poll (โหมด polling หรือกรณี webhook หลุด) — discussions/emojis ทุก 20 วินาที
    // ยิงแบบ silent: อัปเดตข้อมูลเบื้องหลังโดยไม่โชว์ spinner → ไม่เกิดอาการกระพริบ
    const interval = setInterval(() => {
      if (document.hidden) return
      fetchDiscussions(true)
      fetchAwardEmojis()
    }, 20000)

    // real-time: main process broadcast state ใหม่ทุกครั้งที่ sync (webhook/polling)
    // เช็คจาก state ที่แนบมาก่อนว่า MR นี้มีอะไรเปลี่ยนจริงไหม — ถ้าไม่เปลี่ยนก็ไม่ต้องยิง API ซ้ำ
    const unsubscribe = window.electronAPI.onAppStateUpdated((state) => {
      if (document.hidden) return
      const cur = mrRef.current
      const inReviews = state.myReviewMRs.find((m: MergeRequest) => m.projectId === projectId && m.iid === mrIid)
      const found = inReviews ?? state.allOpenMRs.find((m: MergeRequest) => m.projectId === projectId && m.iid === mrIid)
      if (found && cur && found.updatedAt === cur.updatedAt &&
          // pipeline status ถูก patch เฉพาะ list ของ My Reviews — เทียบได้เมื่อเจอในนั้นเท่านั้น
          (!inReviews || inReviews.pipelineStatus === cur.pipelineStatus)) {
        return
      }
      refreshMR()
      fetchDiscussions(true)
      fetchAwardEmojis()
    })

    // real-time: โหมด webhook — main ส่ง note-event ตรงมาเมื่อมีคอมเมนต์ใหม่บน MR นี้
    // ดึง discussions/emojis ใหม่แบบเงียบทันที ไม่ต้องรอ poll 20 วิ
    const unsubscribeNote = window.electronAPI.onMRNoteEvent(({ projectId: p, mrIid: i }) => {
      if (p !== projectId || i !== mrIid || document.hidden) return
      fetchDiscussions(true)
      fetchAwardEmojis()
    })

    const onVisible = () => {
      if (document.hidden) return
      refreshMR()
      fetchDiscussions(true)
      fetchAwardEmojis()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
      unsubscribe()
      unsubscribeNote()
    }
  }, [projectId, mrIid])

  // โหมด webhook: pipeline_events จะ push สถานะมาแทน — poll ตัว MR เหลือแค่ fallback ช้าๆ (30 วิ)
  // โหมด polling: ไม่มี push → poll ทุก 15 วิ ระหว่าง pipeline วิ่ง ให้ badge/ปุ่ม Merge ตามสถานะจริง
  const [webhookMode, setWebhookMode] = useState(false)
  useEffect(() => {
    window.electronAPI.getSettings().then(s => setWebhookMode(s.webhookEnabled)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!mr?.pipelineStatus || !['running', 'pending', 'preparing', 'created', 'waiting_for_resource', 'scheduled'].includes(mr.pipelineStatus)) return
    const interval = setInterval(() => { if (!document.hidden) refreshMR() }, webhookMode ? 30000 : 15000)
    return () => clearInterval(interval)
  }, [mr?.pipelineStatus, webhookMode, projectId, mrIid])

  // โหลด diffs ครั้งแรก และโหลดซ้ำแบบเงียบๆ เมื่อ head sha เปลี่ยน (มี commit ใหม่ push เข้ามา)
  useEffect(() => { mrRef.current = mr }, [mr])
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
    if (!commentText.trim() || submittingComment) return
    setSubmittingComment(true)
    try {
      await window.electronAPI.addMRNote(projectId, mrIid, commentText)
      changeComment('')
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
      const next = new Set(changedSinceReview ? [] : viewedFiles)
      if (next.has(filePath)) next.delete(filePath)
      else next.add(filePath)
      setReviewHead(mr?.sha || null)
      saveReview(next, mr?.sha || null)
      setViewedFiles(next)
  }

  const copyFilePath = async (filePath: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(filePath)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = filePath
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        const copied = document.execCommand('copy')
        textArea.remove()
        if (!copied) throw new Error('Clipboard copy failed')
      }
      setCopiedPath(filePath)
      onToast('File path copied', 'success')
      window.setTimeout(() => setCopiedPath((current) => current === filePath ? null : current), 1500)
    } catch (err) {
      console.error(err)
      onToast('Failed to copy file path', 'error')
    }
  }

  const openFileInIDE = async (filePath: string) => {
    setOpeningPath(filePath)
    try {
      const result = await window.electronAPI.openFileInIDE(projectId, mr?.projectName ?? '', filePath)
      if (result.opened) onToast(result.message ?? 'File opened in IDE', 'success')
      else if (result.message !== 'Repository selection canceled.') onToast(result.message ?? 'Failed to open file in IDE', 'error')
    } catch (err) {
      console.error(err)
      onToast('Failed to open file in IDE', 'error')
    } finally {
      setOpeningPath(null)
    }
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
            sidebarRef={sidebarElementRef}
            resizerRef={resizerElementRef}
            onStartResize={(startX) => {
              resizeStartXRef.current = startX
              resizeStartWidthRef.current = sidebarWidth
              displayedSidebarWidthRef.current = sidebarWidth
              lastLiveResizeAtRef.current = 0
              setIsResizing(true)
            }}
          />
        )}

        <div ref={scrollRef} onScroll={rememberPosition} className="diff-scroll-container flex-1 overflow-y-auto custom-scrollbar relative">
          <div className={`${activeTab === 'changes' ? 'w-full' : 'max-w-5xl mx-auto'} p-6 pb-20`}>
            {activeTab === 'changes' && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  {changedSinceReview && <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-amber-300">New commits since your last review · review viewed files again</span>}
                  {resumePosition && <button type="button" className="rounded-md border border-gray-700 px-2 py-1 hover:text-orange-300" onClick={() => {
                    const card = document.getElementById('diff-' + resumePosition.path)
                    const container = scrollRef.current
                    if (card && container) container.scrollTop += card.getBoundingClientRect().top - container.getBoundingClientRect().top + resumePosition.offset
                  }}>Resume review</button>}
                </div>
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
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={createMarkdownComponents(mr.webUrl)}
                      >
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
                  onChange={changeComment}
                  draftStatus={draftStatus}
                  submitting={submittingComment}
                  disabled={!draftReady}
                  onSubmit={handleAddComment}
                />
              </div>
            ) : (
              <div className="space-y-6 animate-fade-in">
                {mr.hasConflicts && (
                  <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 shadow-sm">
                    <div className="flex min-w-0 items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
                      <div>
                        <h2 className="text-sm font-semibold text-red-200">This merge request has conflicts</h2>
                        <p className="mt-0.5 text-xs leading-relaxed text-red-200/75">
                          Merge is blocked. GitLab shows the exact files and conflicting lines in its conflict resolver.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.electronAPI.openUrl(`${mr.webUrl}/conflicts`)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-red-400/40 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/25 focus:outline-none focus:ring-2 focus:ring-red-400/60"
                    >
                      View conflict files in GitLab
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  </section>
                )}
                <DiffList
                  diffs={orderedDiffs}
                  loading={loadingDiffs}
                  viewedFiles={effectiveViewed}
                  onToggleViewed={toggleViewedFile}
                  onCopyPath={copyFilePath}
                  onOpenInIDE={openFileInIDE}
                  copiedPath={copiedPath}
                  openingPath={openingPath}
                  diffStats={diffStats}
                  viewMode={diffViewMode}
                  onLoadDiff={handleLoadDiff}
                  loadingDiffPaths={loadingDiffPaths}
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

export default function MRDetail(props: MRDetailProps) {
  return <MRDetailContent key={props.projectId + ':' + props.mrIid} {...props} />
}
