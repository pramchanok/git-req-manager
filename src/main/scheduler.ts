import { GitLabClient } from '../shared/gitlab'
import type { AppState, GitLabGroup, GitLabUser, MergeRequest } from '../shared/types'
import { getSettings, isConfigured, pruneNotifiedMRIds } from './store'
import { notifyNewMRs, notifyCIPipelineFailed, notifyLabelsChanged, notifyNewGroupMRs } from './notifier'

type StateChangeCallback = (state: AppState) => void

let intervalHandle: ReturnType<typeof setInterval> | null = null
let previousReviewMRIds = new Set<number>()
let previousPipelineStatuses = new Map<number, MergeRequest['pipelineStatus']>()
let previousMRLabels = new Map<number, string[]>()
let previousGroupMRIds = new Map<number, Set<number>>()
let cachedUser: GitLabUser | null = null

async function fetchPipelinesThrottled(client: GitLabClient, mrs: MergeRequest[], chunkSize = 5): Promise<void> {
  for (let i = 0; i < mrs.length; i += chunkSize) {
    const chunk = mrs.slice(i, i + chunkSize)
    const statuses = await Promise.all(
      chunk.map((mr) => client.getMRPipelines(mr.projectId, mr.iid))
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

export function setStateChangeCallback(cb: StateChangeCallback): void {
  onStateChange = cb
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
  onStateChange({ ...currentState })

  try {
    const settings = getSettings()
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)

    const user = cachedUser ?? (cachedUser = await client.getCurrentUser())
    currentState.currentUser = user

    const [reviewMRs, allOpenMRs] = await Promise.all([
      client.getMRsForReview(user.id).then(async (mrs) => {
        await fetchPipelinesThrottled(client, mrs)
        return mrs
      }),
      client.getAllOpenMRs(settings.projectIds),
    ])

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

    currentState.myReviewMRs = reviewMRs
    currentState.allOpenMRs = allOpenMRs
    currentState.lastSyncedAt = new Date().toISOString()
    currentState.error = null

    // Fetch groups where user is Owner, and notify new MRs for enabled ones
    const ownerGroups = await client.getOwnerGroups().catch((): GitLabGroup[] => [])
    currentState.ownerGroups = ownerGroups

    const notifyGroupIds = settings.notifyOwnerGroupIds ?? []
    for (const groupId of notifyGroupIds) {
      const group = ownerGroups.find((g) => g.id === groupId)
      if (!group) continue

      const groupMRs = await client.getGroupOpenMRs(groupId).catch((): MergeRequest[] => [])
      const prevIds = previousGroupMRIds.get(groupId) ?? new Set<number>()
      const newGroupMRs = groupMRs.filter((mr) => !prevIds.has(mr.id))
      if (newGroupMRs.length > 0) {
        notifyNewGroupMRs(group, newGroupMRs)
      }
      previousGroupMRIds.set(groupId, new Set(groupMRs.map((mr) => mr.id)))
    }

    // Prune notifiedMRIds to only active open MRs (cap 500) to prevent unbounded growth
    const activeMRIds = new Set([...reviewMRs, ...allOpenMRs].map((mr) => mr.id))
    pruneNotifiedMRIds(activeMRIds)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    currentState.error = `Sync failed: ${message}`
  } finally {
    currentState.isSyncing = false
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
