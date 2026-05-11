import { GitLabClient } from '../shared/gitlab'
import type { AppState, GitLabUser, MergeRequest } from '../shared/types'
import { getSettings, isConfigured } from './store'
import { notifyNewMRs, notifyCIPipelineFailed } from './notifier'

type StateChangeCallback = (state: AppState) => void

let intervalHandle: ReturnType<typeof setInterval> | null = null
let previousReviewMRIds = new Set<number>()
let previousPipelineStatuses = new Map<number, MergeRequest['pipelineStatus']>()
let cachedUser: GitLabUser | null = null

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
      client.getMRsForReview(user.id),
      client.getAllOpenMRs(settings.projectIds),
    ])

    // Fetch pipeline status for review MRs (limit API calls to reviews only)
    const pipelineStatuses = await Promise.all(
      reviewMRs.map((mr) => client.getMRPipelines(mr.projectId, mr.iid))
    )

    // Attach pipeline status and detect running→failed transitions
    const ciFailures: MergeRequest[] = []
    reviewMRs.forEach((mr, i) => {
      mr.pipelineStatus = pipelineStatuses[i]
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
