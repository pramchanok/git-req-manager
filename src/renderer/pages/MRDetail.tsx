import { useState, useEffect } from 'react'
import type { MergeRequest, MRDiff, MRDiscussion, MRNote } from '../../shared/types'
import { marked } from 'marked'
import ReactDiffViewer from 'react-diff-viewer-continued'

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

  useEffect(() => {
    const loadData = async () => {
      try {
        const mrData = await window.electronAPI.getMRByIid(projectId, mrIid)
        setMR(mrData)
      } catch (err) {
        console.error(err)
        onToast('Failed to load MR', 'error')
      }
    }
    loadData()
    fetchDiscussions()
    fetchDiffs()
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

  const handleAction = async (action: 'approve' | 'merge' | 'close') => {
    setProcessingAction(true)
    try {
      if (action === 'approve') {
        await window.electronAPI.approveMR(projectId, mrIid)
        onToast('MR Approved')
      } else if (action === 'merge') {
        await window.electronAPI.mergeMR(projectId, mrIid)
        onToast('MR Merged')
      } else if (action === 'close') {
        await window.electronAPI.closeMR(projectId, mrIid)
        onToast('MR Closed')
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
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5 ${
                    mr.pipelineStatus === 'success' ? 'text-green-400 bg-green-500/10' :
                    mr.pipelineStatus === 'failed' ? 'text-red-400 bg-red-500/10' :
                    mr.pipelineStatus === 'running' ? 'text-blue-400 bg-blue-500/10' :
                    'text-gray-400 bg-gray-500/10'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      mr.pipelineStatus === 'success' ? 'bg-green-400' :
                      mr.pipelineStatus === 'failed' ? 'bg-red-400' :
                      mr.pipelineStatus === 'running' ? 'bg-blue-400 animate-pulse' :
                      'bg-gray-400'
                    }`} />
                    Pipeline {mr.pipelineStatus}
                  </span>
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

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        <div className="max-w-5xl mx-auto p-6 pb-32">
          {activeTab === 'overview' ? (
            <div className="space-y-8 animate-fade-in">
              {/* Description Box */}
              <div className="bg-[#161b22] border border-gray-800 rounded-xl p-5 shadow-sm">
                <h3 className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-widest flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                  Description
                </h3>
                {mr.description ? (
                  <div 
                    className="prose prose-invert prose-orange max-w-none text-sm text-gray-300 leading-relaxed marker:text-orange-500 prose-a:text-orange-400 hover:prose-a:text-orange-300 prose-code:text-orange-200 prose-code:bg-gray-800/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-[#0d1117] prose-pre:border prose-pre:border-gray-800"
                    dangerouslySetInnerHTML={{ __html: marked(mr.description) }}
                  />
                ) : (
                  <p className="text-gray-500 italic text-sm">No description provided.</p>
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
                          {d.notes.map((note: MRNote, index: number) => (
                            <div key={note.id} className={`flex gap-4 relative z-10 ${index > 0 ? 'ml-12' : ''}`}>
                              <img 
                                src={note.author.avatarUrl} 
                                alt={note.author.name} 
                                className={`rounded-full bg-gray-800 border border-gray-700 object-cover ${index === 0 ? 'w-10 h-10' : 'w-8 h-8 mt-1'}`}
                              />
                              <div className={`flex-1 bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden transition-colors hover:border-gray-700 shadow-sm ${note.system ? 'bg-transparent border-none' : ''}`}>
                                {!note.system && (
                                  <div className="bg-gray-800/30 px-4 py-2 border-b border-gray-800 flex items-center justify-between">
                                    <span className="font-semibold text-gray-200 text-sm">{note.author.name}</span>
                                    <span className="text-gray-500 text-xs">{new Date(note.createdAt).toLocaleString()}</span>
                                  </div>
                                )}
                                <div className={`px-4 py-3 text-sm text-gray-300 prose prose-invert prose-sm max-w-none prose-a:text-orange-400 prose-code:bg-gray-800/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded ${note.system ? 'px-0 py-1 text-gray-400 italic flex items-center gap-2' : ''}`}>
                                  {note.system && <span className="text-xs">{new Date(note.createdAt).toLocaleString()}</span>}
                                  <div dangerouslySetInnerHTML={{ __html: marked(note.body) }} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comment Input */}
              <div className="mt-8 flex gap-4">
                <div className="flex-1 bg-[#161b22] border border-gray-700 focus-within:border-orange-500 rounded-xl overflow-hidden transition-colors shadow-sm">
                  <div className="bg-gray-800/30 px-4 py-2 border-b border-gray-800">
                    <span className="text-xs font-semibold text-gray-400">Leave a comment</span>
                  </div>
                  <textarea
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Write your thoughts..."
                    className="w-full bg-transparent p-4 text-sm text-white focus:outline-none min-h-[120px] resize-y"
                  />
                  <div className="bg-gray-800/30 px-4 py-3 border-t border-gray-800 flex justify-between items-center">
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
                diffs.map((diff, index) => {
                  const isViewed = viewedFiles.has(diff.newPath)
                  return (
                  <div key={index} className={`bg-[#161b22] border ${isViewed ? 'border-gray-800/40 opacity-70' : 'border-gray-800'} rounded-xl overflow-hidden shadow-sm transition-all`}>
                    {/* File Header */}
                    <div className="bg-gray-800/50 px-4 py-2 text-sm font-mono text-gray-300 border-b border-gray-800 flex justify-between items-center group">
                      <div className="flex items-center gap-3">
                        <svg className="w-4 h-4 text-gray-500 group-hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <span className={isViewed ? 'line-through text-gray-500' : ''}>{diff.newPath}</span>
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
                      <div className="text-[12px] overflow-x-auto bg-[#0d1117] custom-diff-viewer">
                        <ReactDiffViewer
                          oldValue={''} 
                          newValue={diff.diff}
                          splitView={false}
                          useDarkTheme={true}
                          hideLineNumbers={true}
                          styles={{
                            variables: {
                              dark: {
                                diffViewerBackground: 'transparent',
                                diffViewerTitleBackground: '#161b22',
                                diffViewerTitleColor: '#8b949e',
                                addedBackground: 'rgba(46, 160, 67, 0.15)',
                                addedColor: '#e6ffec',
                                removedBackground: 'rgba(248, 81, 73, 0.15)',
                                removedColor: '#ffebe9',
                                wordAddedBackground: 'rgba(46, 160, 67, 0.4)',
                                wordRemovedBackground: 'rgba(248, 81, 73, 0.4)',
                                emptyLineBackground: 'transparent',
                              }
                            },
                            line: {
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                              lineHeight: '1.5',
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
          )}
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
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2 px-6 rounded-lg transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_20px_rgba(37,99,235,0.5)] disabled:opacity-50 disabled:shadow-none disabled:bg-gray-700 disabled:text-gray-400 flex items-center gap-2 border border-transparent disabled:border-gray-600"
                  title={mr.hasConflicts ? 'Has conflicts' : mr.pipelineStatus === 'failed' ? 'Pipeline failed' : 'Merge'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                  Merge
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
