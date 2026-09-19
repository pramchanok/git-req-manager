import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { GitLabGroup, GitLabUser, MergeRequest, Settings } from '../shared/types'

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(), isConfigured: vi.fn(), pruneNotifiedMRIds: vi.fn(),
  hasNotifiedMergedMRId: vi.fn(), addNotifiedMergedMRId: vi.fn(), setNotificationIdentity: vi.fn(),
  notifyNewMRs: vi.fn(), notifyMRMerged: vi.fn(), notifyCIPipelineFailed: vi.fn(),
  notifyLabelsChanged: vi.fn(), notifyNewGroupMRs: vi.fn(), setNotificationScope: vi.fn(),
  api: {
    getCurrentUser: vi.fn(), getMRsForReview: vi.fn(), getAllOpenMRs: vi.fn(),
    getAuthoredOpenMRs: vi.fn(), getMRPipelines: vi.fn(), getOwnerGroups: vi.fn(),
    getGroupOpenMRs: vi.fn(), getMRByIid: vi.fn(),
  },
}))

vi.mock('./store', () => mocks)
vi.mock('./notifier', () => mocks)
vi.mock('./notification-inbox', () => ({ setNotificationScope: mocks.setNotificationScope }))
vi.mock('../shared/gitlab', () => ({ GitLabClient: class { constructor() { return mocks.api } } }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

function mr(id = 1): MergeRequest {
  return {
    id, iid: id, projectId: 10, projectName: 'Project', projectNamespace: 'group/project',
    title: 'Review', description: '', state: 'opened', createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z', mergedAt: null, author: user, assignees: [],
    reviewers: [], mergedBy: null, sourceBranch: 'feature', targetBranch: 'main', webUrl: 'https://gitlab.test/mr/1',
    approvalsRequired: 0, approvalsLeft: 0, draft: false, hasConflicts: false,
    detailedMergeStatus: null, mergeWhenPipelineSucceeds: false, upvotes: 0, downvotes: 0,
    userNotesCount: 0, sha: 'sha', pipelineStatus: null, pipelineId: null, pipelineWebUrl: null,
    labels: [], userCanMerge: false, hasApproved: false,
  }
}

const user: GitLabUser = { id: 5, name: 'Reviewer', username: 'reviewer', avatarUrl: '', webUrl: '' }
const group: GitLabGroup = { id: 9, name: 'Team', fullPath: 'team', webUrl: '' }
let settings: Settings
let scheduler: typeof import('./scheduler')

beforeEach(async () => {
  vi.resetModules()
  vi.resetAllMocks()
  settings = {
    gitlabUrl: 'https://gitlab.test', accessToken: 'test', refreshIntervalMinutes: 5,
    projectIds: [], webhookEnabled: false, webhookPort: 3847, webhookSecret: '', webhookPublicUrl: '',
    webhookUseTunnel: false, launchAtStartup: false, notifyOwnerGroupIds: [], notifyOnMyMRMerged: false,
  }
  mocks.getSettings.mockImplementation(() => settings)
  mocks.isConfigured.mockReturnValue(true)
  mocks.api.getCurrentUser.mockResolvedValue(user)
  mocks.api.getMRsForReview.mockResolvedValue([])
  mocks.api.getAllOpenMRs.mockResolvedValue([])
  mocks.api.getAuthoredOpenMRs.mockResolvedValue([])
  mocks.api.getMRPipelines.mockResolvedValue('success')
  mocks.api.getOwnerGroups.mockResolvedValue([])
  mocks.api.getGroupOpenMRs.mockResolvedValue([])
  mocks.api.getMRByIid.mockResolvedValue(null)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  scheduler = await import('./scheduler')
})

afterEach(() => {
  scheduler?.stopScheduler()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('scheduler synchronization', () => {
  test('coalesces events received during a sync into one subsequent cycle without overlap', async () => {
    const entered = deferred<void>()
    const review = deferred<MergeRequest[]>()
    mocks.api.getMRsForReview.mockImplementationOnce(() => { entered.resolve(); return review.promise })
    const first = scheduler.syncNow()
    await entered.promise
    const second = scheduler.syncNow()
    const third = scheduler.syncNow()
    expect(second).toBe(first)
    expect(third).toBe(first)
    expect(mocks.api.getMRsForReview).toHaveBeenCalledTimes(1)

    review.resolve([mr()])
    await Promise.all([first, second, third])

    expect(mocks.api.getMRsForReview).toHaveBeenCalledTimes(2)
    expect(mocks.api.getAllOpenMRs).toHaveBeenCalledTimes(2)
    expect(scheduler.getAppState().isSyncing).toBe(false)
  })

  test('rejects stale account results and prevents them from seeding pipeline cache after reset', async () => {
    const entered = deferred<void>()
    const oldReviews = deferred<MergeRequest[]>()
    mocks.api.getMRsForReview.mockImplementationOnce(() => { entered.resolve(); return oldReviews.promise })
    const sync = scheduler.syncNow()
    await entered.promise
    scheduler.resetSchedulerCache()
    oldReviews.resolve([mr()])
    await sync

    expect(scheduler.getAppState().currentUser).toBeNull()
    expect(scheduler.getAppState().myReviewMRs).toEqual([])
    expect(mocks.api.getMRPipelines).not.toHaveBeenCalled()
    expect(mocks.notifyNewMRs).not.toHaveBeenCalled()
    expect(scheduler.getAppState().lastSyncedAt).toBeNull()

    mocks.api.getCurrentUser.mockResolvedValue({ ...user, id: 6 })
    mocks.api.getMRsForReview.mockImplementation(async () => [mr()])
    mocks.api.getMRPipelines.mockResolvedValue('failed')
    await scheduler.syncNow()
    expect(scheduler.getAppState().currentUser?.id).toBe(6)
    expect(scheduler.getAppState().myReviewMRs[0].pipelineStatus).toBe('failed')
  })

  test('retains data and successful timestamps for failed sections while refreshing healthy sections', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T10:00:00Z'))
    mocks.api.getMRsForReview.mockResolvedValue([mr()])
    await scheduler.syncNow()
    const first = scheduler.getAppState()
    const firstReviewsAt = first.syncHealth?.reviewsSyncedAt
    mocks.api.getMRsForReview.mockRejectedValue(new Error('reviews unavailable'))
    mocks.api.getAllOpenMRs.mockResolvedValue([mr(2)])
    vi.setSystemTime(new Date('2026-09-19T10:01:00Z'))
    await scheduler.syncNow()
    const partial = scheduler.getAppState()

    expect(partial.myReviewMRs.map((row) => row.id)).toEqual([1])
    expect(partial.allOpenMRs.map((row) => row.id)).toEqual([2])
    expect(partial.lastSyncedAt).toBe(first.lastSyncedAt)
    expect(partial.syncHealth?.reviewsSyncedAt).toBe(firstReviewsAt)
    expect(partial.syncHealth?.allOpenSyncedAt).toBe('2026-09-19T10:01:00.000Z')
    expect(partial.error).toContain('reviews unavailable')
    expect(partial.syncHealth?.durationMs).toBe(0)
  })

  test('preserves group notification baseline through failed fetches', async () => {
    settings.notifyOwnerGroupIds = [group.id]
    mocks.api.getOwnerGroups.mockResolvedValue([group])
    mocks.api.getGroupOpenMRs.mockResolvedValue([mr()])
    await scheduler.syncNow()
    expect(mocks.notifyNewGroupMRs).toHaveBeenCalledTimes(1)
    mocks.api.getGroupOpenMRs.mockRejectedValueOnce(new Error('offline'))
    await scheduler.syncNow()
    expect(scheduler.getAppState().error).toContain('Team could not be refreshed')
    await scheduler.syncNow()
    expect(mocks.notifyNewGroupMRs).toHaveBeenCalledTimes(1)
    expect(scheduler.getAppState().error).toBeNull()
  })
})

describe('pipeline cache', () => {
  test.each([
    { eventType: 'pipeline' as const, projectId: 10, mrIid: 2 },
    { eventType: 'merge_request' as const, mrId: 2 },
  ])('invalidates only the matching MR for $eventType events', async (event) => {
    mocks.api.getMRsForReview.mockImplementation(async () => [mr(1), mr(2), { ...mr(3), projectId: 20 }])
    await scheduler.syncNow()
    mocks.api.getMRPipelines.mockClear()
    scheduler.recordWebhookEvent(event)
    await scheduler.syncNow()
    expect(mocks.api.getMRPipelines).toHaveBeenCalledExactlyOnceWith(10, 2)
  })

  test('records note activity without invalidating any pipeline cache', async () => {
    mocks.api.getMRsForReview.mockImplementation(async () => [mr(1), mr(2)])
    await scheduler.syncNow()
    mocks.api.getMRPipelines.mockClear()
    scheduler.recordWebhookEvent({ eventType: 'note', projectId: 10, mrIid: 1, mrId: 1 })
    scheduler.recordWebhookEvent({ eventType: 'note' })
    await scheduler.syncNow()
    expect(mocks.api.getMRPipelines).not.toHaveBeenCalled()
    expect(scheduler.getAppState().syncHealth?.lastWebhookAt).toBeTruthy()
  })

  test('prefers global MR ID when a fork pipeline reports the source project', async () => {
    mocks.api.getMRsForReview.mockImplementation(async () => [mr(1), { ...mr(2), projectId: 20, iid: 1 }])
    await scheduler.syncNow()
    mocks.api.getMRPipelines.mockClear()
    scheduler.recordWebhookEvent({ eventType: 'pipeline', projectId: 10, mrIid: 1, mrId: 2 })
    await scheduler.syncNow()
    expect(mocks.api.getMRPipelines).toHaveBeenCalledExactlyOnceWith(20, 1)
  })

  test.each([
    { event: { eventType: 'pipeline' as const, projectId: 10 }, calls: [[10, 1], [10, 2]] },
    { event: { eventType: 'pipeline' as const }, calls: [[10, 1], [10, 2], [20, 3]] },
    { event: {}, calls: [[10, 1], [10, 2], [20, 3]] },
    { event: { eventType: 'legacy', projectId: 10 }, calls: [[10, 1], [10, 2]] },
    { event: { eventType: 'pipeline' as const, projectId: 0, mrId: -1 }, calls: [[10, 1], [10, 2], [20, 3]] },
  ])('falls back to project or whole-cache invalidation when MR identity is missing: $event', async ({ event, calls }) => {
    mocks.api.getMRsForReview.mockImplementation(async () => [mr(1), mr(2), { ...mr(3), projectId: 20 }])
    await scheduler.syncNow()
    mocks.api.getMRPipelines.mockClear()
    scheduler.recordWebhookEvent(event)
    await scheduler.syncNow()
    expect(mocks.api.getMRPipelines.mock.calls).toEqual(calls)
  })

  test('invalidating one in-flight MR preserves unrelated in-flight results and existing cache entries', async () => {
    mocks.api.getMRsForReview.mockImplementation(async () => [mr(3)])
    await scheduler.syncNow()
    const entered = deferred<void>()
    const pending = deferred<MergeRequest['pipelineStatus']>()
    mocks.api.getMRsForReview.mockImplementation(async () => [mr(1), mr(2), mr(3)])
    mocks.api.getMRPipelines.mockImplementation((_project: number, iid: number) => {
      if (iid === 1) { entered.resolve(); return pending.promise }
      return Promise.resolve('success')
    })
    const sync = scheduler.syncNow()
    await entered.promise
    scheduler.recordWebhookEvent({ eventType: 'pipeline', projectId: 10, mrIid: 1 })
    pending.resolve('success')
    await sync
    mocks.api.getMRPipelines.mockClear()
    await scheduler.syncNow()
    expect(mocks.api.getMRPipelines).toHaveBeenCalledExactlyOnceWith(10, 1)
  })

  test('refetches pending pipelines and reuses terminal statuses until a webhook invalidates them', async () => {
    mocks.api.getMRsForReview.mockImplementation(async () => [mr()])
    mocks.api.getMRPipelines.mockResolvedValueOnce('pending').mockResolvedValue('success')
    await scheduler.syncNow()
    await scheduler.syncNow()
    await scheduler.syncNow()
    expect(mocks.api.getMRPipelines).toHaveBeenCalledTimes(2)

    scheduler.recordWebhookEvent({ eventType: 'pipeline', projectId: 10, mrIid: 1 })
    expect(scheduler.getAppState().syncHealth?.lastWebhookAt).toBeTruthy()
    await scheduler.syncNow()
    expect(mocks.api.getMRPipelines).toHaveBeenCalledTimes(3)
  })

  test('does not repopulate invalidated cache from a pipeline request already in flight', async () => {
    const entered = deferred<void>()
    const pipeline = deferred<MergeRequest['pipelineStatus']>()
    mocks.api.getMRsForReview.mockImplementation(async () => [mr()])
    mocks.api.getMRPipelines.mockImplementationOnce(() => { entered.resolve(); return pipeline.promise })
    const sync = scheduler.syncNow()
    await entered.promise
    scheduler.recordWebhookEvent({ eventType: 'pipeline', projectId: 10, mrIid: 1 })
    pipeline.resolve('success')
    await sync
    await scheduler.syncNow()
    expect(mocks.api.getMRPipelines).toHaveBeenCalledTimes(2)
  })
})
