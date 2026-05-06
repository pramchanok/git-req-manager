import { GitLabClient } from '../shared/gitlab'
import type { AppState, MergeRequest } from '../shared/types'
import { getSettings, isConfigured } from './store'
import { notifyNewMRs } from './notifier'

type StateChangeCallback = (state: AppState) => void

let intervalHandle: ReturnType<typeof setInterval> | null = null
let previousReviewMRIds = new Set<number>()

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

    const user = await client.getCurrentUser()
    currentState.currentUser = user

    const [reviewMRs, allOpenMRs] = await Promise.all([
      client.getMRsForReview(user.id),
      client.getAllOpenMRs(settings.projectIds),
    ])

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
  const settings = getSettings()
  startScheduler(settings.refreshIntervalMinutes)
}
