import { GitLabClient } from '../shared/gitlab'
import type { AppState, GitLabGroup, GitLabUser, MergeRequest } from '../shared/types'
import { getSettings, isConfigured, pruneNotifiedMRIds, hasNotifiedMergedMRId, addNotifiedMergedMRId, setNotificationIdentity } from './store'
import { notifyNewMRs, notifyMRMerged, notifyCIPipelineFailed, notifyLabelsChanged, notifyNewGroupMRs } from './notifier'
import { setNotificationScope } from './notification-inbox'

type StateChangeCallback = (state: AppState) => void

let intervalHandle: ReturnType<typeof setInterval> | null = null
let previousReviewMRIds = new Set<number>()
let previousPipelineStatuses = new Map<number, MergeRequest['pipelineStatus']>()
let previousMRLabels = new Map<number, string[]>()
let previousGroupMRIds = new Map<number, Set<number>>()
// Track user's authored open MRs — used to detect when one gets merged/closed
let previousAuthoredOpenMRIds = new Map<number, { projectId: number; iid: number }>()
let cachedUser: GitLabUser | null = null
let generation = 0
let syncTask: Promise<void> | null = null
let syncPending = false
let pipelineEpoch = 0

const OWNER_GROUPS_TTL = 10 * 60 * 1000
let ownerGroupsCache: { groups: GitLabGroup[]; fetchedAt: number } | null = null

// Cache สถานะ pipeline ราย MR — สถานะ terminal (success/failed/canceled) จะเปลี่ยนได้ก็ต่อเมื่อ
// มี pipeline ใหม่ (commit ใหม่ → updatedAt เปลี่ยน) หรือ user กด retry ซึ่งไม่แตะ updatedAt
// จึงใส่ TTL 5 นาทีกันค้างจากเคส retry — ส่วนสถานะ null/running fetch ใหม่เสมอ
const PIPELINE_CACHE_TTL = 5 * 60 * 1000
type PipelineCacheEntry = {
  projectId: number
  mrIid: number
  updatedAt: string
  status: MergeRequest['pipelineStatus']
  cachedAt: number
}
let pipelineCache = new Map<number, PipelineCacheEntry>()

export type WebhookCacheEvent = {
  // Older relays omit the type; unknown events use conservative invalidation.
  eventType?: string
  projectId?: number | null
  mrIid?: number | null
  mrId?: number | null
}

async function fetchPipelinesThrottled(client: GitLabClient, mrs: MergeRequest[], chunkSize = 5): Promise<void> {
  const epoch = pipelineEpoch
  const accountGeneration = generation
  const now = Date.now()
  const toFetch: MergeRequest[] = []
  for (const mr of mrs) {
    const cached = pipelineCache.get(mr.id)
    const isTerminal = cached && ['success', 'failed', 'canceled', 'skipped'].includes(cached.status ?? '')
    if (cached && isTerminal && cached.updatedAt === mr.updatedAt && now - cached.cachedAt < PIPELINE_CACHE_TTL) {
      mr.pipelineStatus = cached.status
    } else {
      toFetch.push(mr)
    }
  }

  for (let i = 0; i < toFetch.length; i += chunkSize) {
    if (accountGeneration !== generation) break
    const chunk = toFetch.slice(i, i + chunkSize)
    // The entry object doubles as a request revision. Removing it invalidates
    // only this MR's in-flight result without retaining a separate revision map.
    const entries = chunk.map((mr): PipelineCacheEntry => {
      const entry = { projectId: mr.projectId, mrIid: mr.iid, updatedAt: mr.updatedAt, status: null, cachedAt: 0 }
      if (epoch === pipelineEpoch) pipelineCache.set(mr.id, entry)
      return entry
    })
    const statuses = await Promise.all(
      chunk.map((mr) => client.getMRPipelines(mr.projectId, mr.iid).catch((err) => {
        console.error(`[scheduler] Failed to fetch pipeline for MR !${mr.iid}:`, err instanceof Error ? err.message : String(err))
        return null
      }))
    )
    chunk.forEach((mr, j) => {
      mr.pipelineStatus = statuses[j]
      if (epoch === pipelineEpoch && pipelineCache.get(mr.id) === entries[j]) {
        entries[j].status = statuses[j]
        entries[j].cachedAt = now
      }
    })
  }

  // กัน cache โตไม่จำกัด — เก็บเฉพาะ MR ที่ยังอยู่ในรอบนี้
  const activeIds = new Set(mrs.map((mr) => mr.id))
  for (const id of epoch === pipelineEpoch ? pipelineCache.keys() : []) {
    if (!activeIds.has(id)) pipelineCache.delete(id)
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
  syncHealth: { lastAttemptAt: null, lastWebhookAt: null, reviewsSyncedAt: null, allOpenSyncedAt: null, durationMs: null },
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

export function syncNow(): Promise<void> {
  syncPending = true
  if (!syncTask) {
    syncTask = Promise.resolve().then(async () => {
      while (syncPending) {
        syncPending = false
        await runSyncCycle()
      }
    }).finally(() => { syncTask = null })
  }
  return syncTask
}

export function recordWebhookEvent(event: WebhookCacheEvent): void {
  if (event.eventType !== 'note') {
    const hasId = (value: number | null | undefined): value is number => Number.isInteger(value) && Number(value) > 0
    const hasMRId = hasId(event.mrId)
    const hasProject = hasId(event.projectId)
    const hasPair = hasProject && hasId(event.mrIid)
    if (!hasMRId && !hasProject) {
      pipelineEpoch++
      pipelineCache.clear()
    } else {
      for (const [id, entry] of pipelineCache) {
        // A fork pipeline's project can be the source project while mrId belongs
        // to the target project, so its global MR ID takes precedence.
        const matches = hasMRId ? id === event.mrId :
          entry.projectId === event.projectId && (!hasPair || entry.mrIid === event.mrIid)
        if (matches) pipelineCache.delete(id)
      }
    }
  }
  currentState.syncHealth!.lastWebhookAt = new Date().toISOString()
  onStateChange({ ...currentState })
}

async function runSyncCycle(): Promise<void> {
  const cycleGeneration = generation
  const started = Date.now()
  currentState.syncHealth!.lastAttemptAt = new Date(started).toISOString()

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

    const user = cachedUser ?? await client.getCurrentUser()
    if (cycleGeneration !== generation) return
    cachedUser = user
    setNotificationIdentity(settings.gitlabUrl, user.id)
    setNotificationScope(settings.gitlabUrl, user.id)
    currentState.currentUser = user

    const [reviewResult, allOpenResult, authoredResult] = await Promise.allSettled([
      client.getMRsForReview(user.id).then(async (mrs) => {
        if (cycleGeneration !== generation) return mrs
        await fetchPipelinesThrottled(client, mrs)
        return mrs
      }),
      client.getAllOpenMRs(settings.projectIds),
      // Fetch MRs authored by current user — to detect merged ones
      settings.notifyOnMyMRMerged
        ? client.getAuthoredOpenMRs(user.id)
        : Promise.resolve(null),
    ])
    if (cycleGeneration !== generation) return

    const reviewMRs = reviewResult.status === 'fulfilled' ? reviewResult.value : currentState.myReviewMRs
    const allOpenMRs = allOpenResult.status === 'fulfilled' ? allOpenResult.value : currentState.allOpenMRs
    const authoredOpenMRs = authoredResult.status === 'fulfilled' ? authoredResult.value : null

    const syncErrors: string[] = []
    if (reviewResult.status === 'rejected') syncErrors.push(`[API Error] My Reviews: ${reviewResult.reason instanceof Error ? reviewResult.reason.message : String(reviewResult.reason)}`)
    if (allOpenResult.status === 'rejected') syncErrors.push(`[API Error] All Open: ${allOpenResult.reason instanceof Error ? allOpenResult.reason.message : String(allOpenResult.reason)}`)
    if (authoredResult.status === 'rejected') syncErrors.push('Authored MRs could not be refreshed.')

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

    const reviewMRIds = new Set(reviewMRs.map((mr) => mr.id))

    // Detect newly assigned review MRs for notifications
    const newReviewMRs = reviewMRs.filter((mr) => !previousReviewMRIds.has(mr.id))
    if (newReviewMRs.length > 0) {
      notifyNewMRs(newReviewMRs)
    }
    previousReviewMRIds = reviewMRIds

    // Detect label changes across all tracked MRs
    const allTrackedMRs = [...reviewMRs, ...allOpenMRs.filter((mr) => !reviewMRIds.has(mr.id))]
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
        if (cycleGeneration !== generation) return
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
    const reviewPipelines = new Map((reviewResult.status === 'fulfilled' ? reviewMRs : [])
      .filter(mr => mr.pipelineStatus !== null).map(mr => [mr.id, mr.pipelineStatus]))
    currentState.allOpenMRs = allOpenMRs.map(mr => reviewPipelines.has(mr.id) ? { ...mr, pipelineStatus: reviewPipelines.get(mr.id)! } : mr)
    const syncedAt = new Date().toISOString()
    if (reviewResult.status === 'fulfilled') currentState.syncHealth!.reviewsSyncedAt = syncedAt
    if (allOpenResult.status === 'fulfilled') currentState.syncHealth!.allOpenSyncedAt = syncedAt

    // Fetch groups where user is Owner (cache 10 นาที — รายชื่อ group แทบไม่เปลี่ยน) and notify new MRs for enabled ones
    if (!ownerGroupsCache || Date.now() - ownerGroupsCache.fetchedAt > OWNER_GROUPS_TTL) {
      const groups = await client.getOwnerGroups().catch((err): GitLabGroup[] | null => {
        console.error('[scheduler] Failed to fetch owner groups:', err instanceof Error ? err.message : String(err))
        return null
      })
      if (cycleGeneration !== generation) return
      if (groups !== null) ownerGroupsCache = { groups, fetchedAt: Date.now() }
      else syncErrors.push('Owner groups could not be refreshed.')
    }
    const ownerGroups = ownerGroupsCache?.groups ?? []
    currentState.ownerGroups = ownerGroups

    const notifyGroupIds = settings.notifyOwnerGroupIds ?? []
    await Promise.all(notifyGroupIds.map(async (groupId) => {
      const group = ownerGroups.find((g) => g.id === groupId)
      if (!group) return

      const groupMRs = await client.getGroupOpenMRs(groupId).catch((err): null => {
        console.error(`[scheduler] Failed to fetch open MRs for group ${groupId}:`, err instanceof Error ? err.message : String(err))
        syncErrors.push(`Group ${group.name} could not be refreshed.`)
        return null
      })
      if (cycleGeneration !== generation || groupMRs === null) return
      const prevIds = previousGroupMRIds.get(groupId) ?? new Set<number>()
      const newGroupMRs = groupMRs.filter((mr) => !prevIds.has(mr.id))
      if (newGroupMRs.length > 0) {
        notifyNewGroupMRs(group, newGroupMRs)
      }
      previousGroupMRIds.set(groupId, new Set(groupMRs.map((mr) => mr.id)))
    }))
    if (cycleGeneration !== generation) return
    currentState.error = syncErrors.length ? syncErrors.join(' | ') : null
    if (syncErrors.length === 0) currentState.lastSyncedAt = new Date().toISOString()

    // Prune notifiedMRIds to only active open MRs (cap 500) to prevent unbounded growth
    const activeMRIds = new Set([...reviewMRs, ...allOpenMRs].map((mr) => mr.id))
    for (const groupId of notifyGroupIds) {
      for (const id of previousGroupMRIds.get(groupId) ?? []) activeMRIds.add(id)
    }
    pruneNotifiedMRIds(activeMRIds)
  } catch (err) {
    if (cycleGeneration !== generation) return
    const message = err instanceof Error ? err.message : String(err)
    currentState.error = `Sync failed: ${message}`
  } finally {
    if (cycleGeneration === generation) currentState.syncHealth!.durationMs = Date.now() - started
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
  syncPending = false
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
 * Reset cached identity/state. Must be called when settings change
 * (GitLab URL or token) so the next sync re-fetches the current user
 * instead of reusing the previous account's identity.
 */
export function resetSchedulerCache(): void {
  generation++
  pipelineEpoch++
  cachedUser = null
  previousReviewMRIds.clear()
  previousPipelineStatuses.clear()
  previousMRLabels.clear()
  previousGroupMRIds.clear()
  previousAuthoredOpenMRIds = new Map()
  pipelineCache = new Map()
  ownerGroupsCache = null
  currentState.myReviewMRs = []
  currentState.allOpenMRs = []
  currentState.ownerGroups = []
  currentState.currentUser = null
  currentState.lastSyncedAt = null
  currentState.error = null
  currentState.syncHealth = { lastAttemptAt: null, lastWebhookAt: null, reviewsSyncedAt: null, allOpenSyncedAt: null, durationMs: null }
  setNotificationScope(null, null)
  setNotificationIdentity(null, null)
  onStateChange({ ...currentState })
}

/**
 * Called from webhook handler when action=merge is received in real-time.
 * Immediately notifies the author without waiting for next sync cycle.
 */
export async function handleWebhookMerge(authorId: number, projectId: number, mrIid: number): Promise<void> {
  const eventGeneration = generation
  const settings = getSettings()
  if (!settings.notifyOnMyMRMerged) return

  const currentUserId = cachedUser?.id
  if (!currentUserId || currentUserId !== authorId) return

  const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)
  const mr = await client.getMRByIid(projectId, mrIid).catch(() => null)

  if (!mr || eventGeneration !== generation || mr.state !== 'merged') return
  if (hasNotifiedMergedMRId(mr.id)) return

  addNotifiedMergedMRId(mr.id)
  notifyMRMerged(mr)
  console.log(`[webhook] MR !${mrIid} merged (real-time) — notified author`)
}

