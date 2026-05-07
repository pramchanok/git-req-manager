import { useState, useCallback, useRef, useMemo } from 'react'
import type { AppState, GitLabUser, MergeRequest } from '../../../shared/types'
import MRCard from '../components/MRCard'

interface TeamReportProps {
  appState: AppState
}

type DetailTab = 'authored' | 'reviewing' | 'assigned' | 'merged'

interface DevSummary {
  user: GitLabUser
  authored: MergeRequest[]
  reviewing: MergeRequest[]
  assigned: MergeRequest[]
}

const FALLBACK_AVATAR =
  'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="%236b7280"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" fill="%236b7280"/></svg>'

function buildDevSummary(mrs: MergeRequest[]): Map<string, DevSummary> {
  const map = new Map<string, DevSummary>()

  const getOrCreate = (user: GitLabUser): DevSummary => {
    if (!map.has(user.username)) {
      map.set(user.username, { user, authored: [], reviewing: [], assigned: [] })
    }
    return map.get(user.username)!
  }

  for (const mr of mrs) {
    getOrCreate(mr.author).authored.push(mr)
    for (const reviewer of mr.reviewers) getOrCreate(reviewer).reviewing.push(mr)
    for (const assignee of mr.assignees) getOrCreate(assignee).assigned.push(mr)
  }

  return map
}

export default function TeamReport({ appState }: TeamReportProps) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [activeDetailTab, setActiveDetailTab] = useState<Map<string, DetailTab>>(new Map())
  const [mergedData, setMergedData] = useState<Map<string, MergeRequest[] | 'loading'>>(new Map())
  const loadedSet = useRef(new Set<string>())

  // Merge allOpenMRs + myReviewMRs (deduplicated) so the current user always appears
  const allMRs = useMemo(() => {
    const seen = new Set<number>()
    const combined: MergeRequest[] = []
    for (const mr of [...appState.allOpenMRs, ...appState.myReviewMRs]) {
      if (!seen.has(mr.id)) {
        seen.add(mr.id)
        combined.push(mr)
      }
    }
    return combined
  }, [appState.allOpenMRs, appState.myReviewMRs])

  const devSummaries = useMemo(
    () => Array.from(buildDevSummary(allMRs).values()),
    [allMRs]
  )

  const filtered = search.trim()
    ? devSummaries.filter(
        (d) =>
          d.user.name.toLowerCase().includes(search.toLowerCase()) ||
          d.user.username.toLowerCase().includes(search.toLowerCase())
      )
    : devSummaries

  const sorted = [...filtered].sort((a, b) => {
    const total = (s: DevSummary) => s.authored.length + s.reviewing.length + s.assigned.length
    return total(b) - total(a)
  })

  const loadMerged = useCallback(async (username: string) => {
    if (loadedSet.current.has(username)) return
    loadedSet.current.add(username)
    setMergedData((prev) => new Map(prev).set(username, 'loading'))
    try {
      const mrs = await window.electronAPI.getMergedMRsByAuthor(username)
      setMergedData((prev) => new Map(prev).set(username, mrs))
    } catch {
      setMergedData((prev) => new Map(prev).set(username, []))
    }
  }, [])

  const toggleExpand = useCallback((username: string, summary: DevSummary) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(username)) next.delete(username)
      else next.add(username)
      return next
    })
    // Default to whichever role has the most MRs
    setActiveDetailTab((prev) => {
      if (prev.has(username)) return prev
      const best = (['authored', 'reviewing', 'assigned'] as const).reduce(
        (a, b) => (summary[a].length >= summary[b].length ? a : b)
      )
      return new Map(prev).set(username, best)
    })
    // Pre-fetch merged MRs in background so count is ready when tab is clicked
    void loadMerged(username)
  }, [loadMerged])

  const handleDetailTab = (username: string, tab: DetailTab) => {
    setActiveDetailTab((prev) => new Map(prev).set(username, tab))
    if (tab === 'merged') void loadMerged(username)
  }

  if (!appState.isConfigured) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500 text-sm">Configure GitLab settings first.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-700">
        <input
          type="text"
          placeholder="Search developer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-700 text-white text-xs rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-orange-500 placeholder-gray-500"
        />
      </div>

      {/* Dev list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">
              {appState.allOpenMRs.length === 0 ? 'No open MRs yet.' : 'No developers found.'}
            </p>
          </div>
        ) : (
          sorted.map((summary) => {
            const { user, authored, reviewing, assigned } = summary
            const isExpanded = expanded.has(user.username)
            const detailTab = activeDetailTab.get(user.username) ?? 'authored'
            const mergedEntry = mergedData.get(user.username)

            const detailMrs =
              detailTab === 'merged'
                ? mergedEntry === 'loading' || mergedEntry === undefined
                  ? []
                  : mergedEntry
                : summary[detailTab]

            return (
              <div key={user.username} className="border-b border-gray-700">
                {/* Dev row */}
                <div
                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-800 cursor-pointer"
                  onClick={() => toggleExpand(user.username, summary)}
                >
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-8 h-8 rounded-full flex-shrink-0"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = FALLBACK_AVATAR
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{user.name}</p>
                    <p className="text-xs text-gray-500">@{user.username}</p>
                  </div>
                  {/* Role count badges */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {authored.length > 0 && (
                      <span
                        className="text-xs bg-orange-900 text-orange-300 px-1.5 py-0.5 rounded"
                        title="Authored"
                      >
                        ✍️ {authored.length}
                      </span>
                    )}
                    {reviewing.length > 0 && (
                      <span
                        className="text-xs bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded"
                        title="Reviewing"
                      >
                        👁 {reviewing.length}
                      </span>
                    )}
                    {assigned.length > 0 && (
                      <span
                        className="text-xs bg-green-900 text-green-300 px-1.5 py-0.5 rounded"
                        title="Assigned"
                      >
                        📌 {assigned.length}
                      </span>
                    )}
                    {authored.length === 0 && reviewing.length === 0 && assigned.length === 0 && (
                      <span className="text-xs text-gray-600">no MRs</span>
                    )}
                    <span className="text-gray-600 text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Detail panel */}
                {isExpanded && (
                  <div className="border-t border-gray-700">
                    {/* Inner role tabs */}
                    <div className="flex bg-gray-800 border-b border-gray-700">
                      {(
                        [
                          { key: 'authored' as DetailTab, label: `✍️ ${authored.length}`, title: 'Authored' },
                          { key: 'reviewing' as DetailTab, label: `👁 ${reviewing.length}`, title: 'Reviewing' },
                          { key: 'assigned' as DetailTab, label: `📌 ${assigned.length}`, title: 'Assigned' },
                          {
                            key: 'merged' as DetailTab,
                            label:
                              mergedEntry === 'loading'
                                ? '📋 …'
                                : Array.isArray(mergedEntry)
                                ? `📋 ${mergedEntry.length}`
                                : '📋 Merged',
                            title: 'Merged (30d)',
                          },
                        ]
                      ).map(({ key, label, title }) => (
                        <button
                          key={key}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDetailTab(user.username, key)
                          }}
                          title={title}
                          className={`flex-1 py-1.5 text-xs transition-colors ${
                            detailTab === key
                              ? 'text-white border-b-2 border-orange-400'
                              : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* MR list */}
                    <div>
                      {detailTab === 'merged' && mergedEntry === 'loading' ? (
                        <p className="text-xs text-gray-500 px-4 py-3 text-center animate-pulse">
                          Loading…
                        </p>
                      ) : detailMrs.length === 0 ? (
                        <p className="text-xs text-gray-500 px-4 py-3 text-center">No MRs.</p>
                      ) : (
                        detailMrs.map((mr) => <MRCard key={mr.id} mr={mr} />)
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
