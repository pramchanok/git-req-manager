import { GitLabClient } from '../shared/gitlab'
import type { AppState, GitLabGroup, GitLabUser, MergeRequest } from '../shared/types'
import { getSettings, isConfigured, pruneNotifiedMRIds, hasNotifiedMergedMRId, addNotifiedMergedMRId } from './store'
import { notifyNewMRs, notifyMRMerged, notifyCIPipelineFailed, notifyLabelsChanged, notifyNewGroupMRs } from './notifier'

type StateChangeCallback = (state: AppState) => void

let intervalHandle: ReturnType<typeof setInterval> | null = null
let previousReviewMRIds = new Set<number>()
let previousPipelineStatuses = new Map<number, MergeRequest['pipelineStatus']>()
let previousMRLabels = new Map<number, string[]>()
let previousGroupMRIds = new Map<number, Set<number>>()
// Track user's authored open MRs — used to detect when one gets merged/closed
let previousAuthoredOpenMRIds = new Map<number, { projectId: number; iid: number }>()
let cachedUser: GitLabUser | null = null

async function fetchPipelinesThrottled(client: GitLabClient, mrs: MergeRequest[], chunkSize = 5): Promise<void> {
  for (let i = 0; i < mrs.length; i += chunkSize) {
    const chunk = mrs.slice(i, i + chunkSize)
    const statuses = await Promise.all(
      chunk.map((mr) => client.getMRPipelines(mr.projectId, mr.iid).catch((err) => {
        console.error(`[scheduler] Failed to fetch pipeline for MR !${mr.iid}:`, err instanceof Error ? err.message : String(err))
        return null
      }))
    )
    chunk.forEach((mr, j) => { mr.pipelineStatus = statuses[j] })
  }
}

const currentState: AppState = {
  myReviewMRs: [],
  allOpenMRs: [],
  lastSyncedAt: null,
  isSyncing: false,
  error: null,
  currentUser: null,
  isConfigured: false,
  ownerGroups: [],
}

let onStateChange: StateChangeCallback = () => {}
let onSyncStatusChange: (isSyncing: boolean) => void = () => {}

export function setStateChangeCallback(cb: StateChangeCallback): void {
  onStateChange = cb
}

export function setSyncStatusChangeCallback(cb: (isSyncing: boolean) => void): void {
  onSyncStatusChange = cb
}

export function getAppState(): AppState {
  return { ...currentState }
}

export async function syncNow(): Promise<void> {
  if (currentState.isSyncing) return

  if (!isConfigured()) {
    currentState.isConfigured = false
    currentState.error = 'Please configure your GitLab URL and access token in Settings.'
    onStateChange({ ...currentState })
    return
  }

  currentState.isSyncing = true
  currentState.isConfigured = true
  currentState.error = null
  onSyncStatusChange(true)

  try {
    const settings = getSettings()
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)

    const user = cachedUser ?? (cachedUser = await client.getCurrentUser())
    currentState.currentUser = user

    const [reviewResult, allOpenResult, authoredResult] = await Promise.allSettled([
      client.getMRsForReview(user.id).then(async (mrs) => {
        await fetchPipelinesThrottled(client, mrs)
        return mrs
      }),
      client.getAllOpenMRs(settings.projectIds),
      // Fetch MRs authored by current user — to detect merged ones
      settings.notifyOnMyMRMerged
        ? client.getAuthoredOpenMRs(user.id)
        : Promise.resolve(null),
    ])

    const reviewMRs = reviewResult.status === 'fulfilled' ? reviewResult.value : currentState.myReviewMRs
    const allOpenMRs = allOpenResult.status === 'fulfilled' ? allOpenResult.value : currentState.allOpenMRs
    const authoredOpenMRs = authoredResult.status === 'fulfilled' ? authoredResult.value : null

    const syncErrors: string[] = []
    if (reviewResult.status === 'rejected') syncErrors.push(`[API Error] My Reviews: ${reviewResult.reason instanceof Error ? reviewResult.reason.message : String(reviewResult.reason)}`)
    if (allOpenResult.status === 'rejected') syncErrors.push(`[API Error] All Open: ${allOpenResult.reason instanceof Error ? allOpenResult.reason.message : String(allOpenResult.reason)}`)

    currentState.error = syncErrors.length > 0 ? syncErrors.join(' | ') : null

    // Detect running→failed pipeline transitions
    const ciFailures: MergeRequest[] = []
    reviewMRs.forEach((mr) => {
      const prev = previousPipelineStatuses.get(mr.id)
      if (prev === 'running' && mr.pipelineStatus === 'failed') {
        ciFailures.push(mr)
      }
    })
    previousPipelineStatuses = new Map(reviewMRs.map((mr) => [mr.id, mr.pipelineStatus]))
    if (ciFailures.length > 0) notifyCIPipelineFailed(ciFailures)

    // Detect newly assigned review MRs for notifications
    const newReviewMRs = reviewMRs.filter((mr) => !previousReviewMRIds.has(mr.id))
    if (newReviewMRs.length > 0) {
      notifyNewMRs(newReviewMRs)
    }
    previousReviewMRIds = new Set(reviewMRs.map((mr: MergeRequest) => mr.id))

    // Detect label changes across all tracked MRs
    const allTrackedMRs = [...reviewMRs, ...allOpenMRs.filter((mr) => !reviewMRs.some((r) => r.id === mr.id))]
    if (previousMRLabels.size > 0) {
      for (const mr of allTrackedMRs) {
        const prev = previousMRLabels.get(mr.id)
        if (prev === undefined) continue
        const currentNames = mr.labels.map((l) => l.name)
        const added = currentNames.filter((n) => !prev.includes(n))
        const removed = prev.filter((n) => !currentNames.includes(n))
        if (added.length > 0 || removed.length > 0) {
          notifyLabelsChanged(mr, added, removed)
        }
      }
    }
    previousMRLabels = new Map(allTrackedMRs.map((mr) => [mr.id, mr.labels.map((l) => l.name)]))

    // ── Detect authored MRs that got merged ──
    if (settings.notifyOnMyMRMerged && authoredOpenMRs !== null && previousAuthoredOpenMRIds.size > 0) {
      const currentAuthoredIds = new Set(authoredOpenMRs.map((mr) => mr.id))
      // Find MR IDs that were open last cycle but are now gone
      const disappeared = [...previousAuthoredOpenMRIds.entries()].filter(([id]) => !currentAuthoredIds.has(id))

      for (const [id, { projectId, iid }] of disappeared) {
        if (hasNotifiedMergedMRId(id)) continue
        // Verify actual state via API (could be close, not merge)
        const mr = await client.getMRByIid(projectId, iid).catch(() => null)
        if (mr?.state === 'merged') {
          addNotifiedMergedMRId(id)
          notifyMRMerged(mr)
          console.log(`[scheduler] MR !${iid} merged — notified author`)
        }
      }
    }
    // Update authored open MR tracking map
    if (authoredOpenMRs !== null) {
      previousAuthoredOpenMRIds = new Map(
        authoredOpenMRs.map((mr) => [mr.id, { projectId: mr.projectId, iid: mr.iid }])
      )
    }

    currentState.myReviewMRs = reviewMRs
    currentState.allOpenMRs = allOpenMRs
    currentState.lastSyncedAt = new Date().toISOString()

    // Fetch groups where user is Owner, and notify new MRs for enabled ones
    const ownerGroups = await client.getOwnerGroups().catch((err): GitLabGroup[] => {
      console.error('[scheduler] Failed to fetch owner groups:', err instanceof Error ? err.message : String(err))
      return []
    })
    currentState.ownerGroups = ownerGroups

    const notifyGroupIds = settings.notifyOwnerGroupIds ?? []
    await Promise.all(notifyGroupIds.map(async (groupId) => {
      const group = ownerGroups.find((g) => g.id === groupId)
      if (!group) return

      const groupMRs = await client.getGroupOpenMRs(groupId).catch((err): MergeRequest[] => {
        console.error(`[scheduler] Failed to fetch open MRs for group ${groupId}:`, err instanceof Error ? err.message : String(err))
        return []
      })
      const prevIds = previousGroupMRIds.get(groupId) ?? new Set<number>()
      const newGroupMRs = groupMRs.filter((mr) => !prevIds.has(mr.id))
      if (newGroupMRs.length > 0) {
        notifyNewGroupMRs(group, newGroupMRs)
      }
      previousGroupMRIds.set(groupId, new Set(groupMRs.map((mr) => mr.id)))
    }))

    // Prune notifiedMRIds to only active open MRs (cap 500) to prevent unbounded growth
    const activeMRIds = new Set([...reviewMRs, ...allOpenMRs].map((mr) => mr.id))
    pruneNotifiedMRIds(activeMRIds)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    currentState.error = `Sync failed: ${message}`
  } finally {
    currentState.isSyncing = false
    onSyncStatusChange(false)
    onStateChange({ ...currentState })
  }
}

export function startScheduler(intervalMinutes: number): void {
  stopScheduler()
  syncNow()
  intervalHandle = setInterval(() => {
    syncNow()
  }, intervalMinutes * 60 * 1000)
}

export function stopScheduler(): void {
  if (intervalHandle !== null) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
}

export function restartScheduler(): void {
  cachedUser = null
  const settings = getSettings()
  startScheduler(settings.refreshIntervalMinutes)
}

/**
 * Called from webhook handler when action=merge is received in real-time.
 * Immediately notifies the author without waiting for next sync cycle.
 */
export async function handleWebhookMerge(authorId: number, projectId: number, mrIid: number): Promise<void> {
  const settings = getSettings()
  if (!settings.notifyOnMyMRMerged) return

  const currentUserId = cachedUser?.id
  if (!currentUserId || currentUserId !== authorId) return

  const mr = await ((): Promise<MergeRequest | null> => {
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)
    return client.getMRByIid(projectId, mrIid).catch(() => null)
  })()

  if (!mr) return
  if (hasNotifiedMergedMRId(mr.id)) return

  addNotifiedMergedMRId(mr.id)
  notifyMRMerged(mr)
  console.log(`[webhook] MR !${mrIid} merged (real-time) — notified author`)
}

