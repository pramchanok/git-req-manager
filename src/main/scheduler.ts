import { GitLabClient } from '../shared/gitlab'
import type { AppState, GitLabUser, MergeRequest } from '../shared/types'
import { getSettings, isConfigured, pruneNotifiedMRIds } from './store'
import { notifyNewMRs, notifyCIPipelineFailed } from './notifier'

type StateChangeCallback = (state: AppState) => void

let intervalHandle: ReturnType<typeof setInterval> | null = null
let previousReviewMRIds = new Set<number>()
let previousPipelineStatuses = new Map<number, MergeRequest['pipelineStatus']>()
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

    currentState.myReviewMRs = reviewMRs
    currentState.allOpenMRs = allOpenMRs
    currentState.lastSyncedAt = new Date().toISOString()
    currentState.error = null

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
