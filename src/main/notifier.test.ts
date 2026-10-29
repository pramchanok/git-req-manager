import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitLabGroup, MergeRequest } from '../shared/types'

const mocks = vi.hoisted(() => ({
  recordNotification: vi.fn(), getNotificationAccountKey: vi.fn(),
  getNotifiedMRIds: vi.fn(), addNotifiedMRId: vi.fn(), openExternal: vi.fn(),
  shown: [] as Array<{ options: { title: string; body: string }; click?: () => void }>,
}))
vi.mock('./notification-inbox', () => mocks)
vi.mock('./store', () => mocks)
vi.mock('electron', () => ({
  shell: { openExternal: mocks.openExternal }, app: { focus: vi.fn() },
  Notification: class {
    static isSupported() { return true }
    click?: () => void
    constructor(public options: { title: string; body: string }) {}
    on(_event: string, callback: () => void) { this.click = callback }
    show() { mocks.shown.push(this) }
  },
}))

let notifier: typeof import('./notifier')
const mr = (id: number): MergeRequest => ({
  id, iid: id, projectId: 10, title: `MR ${id}`, author: { name: 'Reviewer' },
  webUrl: `https://gitlab.test/group/project/-/merge_requests/${id}`, targetBranch: 'main',
} as MergeRequest)
const group: GitLabGroup = { id: 1, name: 'Team', fullPath: 'team', webUrl: 'https://gitlab.test/groups/team' }

beforeEach(async () => {
  vi.resetModules()
  vi.resetAllMocks()
  mocks.shown = []
  mocks.recordNotification.mockReturnValue(true)
  mocks.getNotificationAccountKey.mockReturnValue('https://gitlab.test:1')
  mocks.getNotifiedMRIds.mockReturnValue(new Set<number>())
  notifier = await import('./notifier')
})

describe('desktop notification integration', () => {
  it('opens the captured MR when the active account still matches', () => {
    const open = vi.fn()
    notifier.setMRClickHandler(open)
    notifier.notifyMRMerged(mr(7))
    mocks.shown[0].click?.()
    expect(open).toHaveBeenCalledExactlyOnceWith(10, 7)
    expect(mocks.openExternal).not.toHaveBeenCalled()
  })

  it.each(['https://gitlab.test:2', 'https://other.test:1', null])('ignores an old popup after switching to %s', account => {
    const open = vi.fn()
    notifier.setMRClickHandler(open)
    notifier.notifyMRMerged(mr(7))
    mocks.getNotificationAccountKey.mockReturnValue(account)
    mocks.shown[0].click?.()
    expect(open).not.toHaveBeenCalled()
    expect(mocks.openExternal).not.toHaveBeenCalled()
  })

  it('records every bulk group MR while grouping only popup-eligible items', () => {
    const rows = Array.from({ length: 7 }, (_, index) => mr(index + 1))
    mocks.recordNotification.mockImplementation((_title: string, _body: string, item: MergeRequest) => item.id > 2)
    notifier.notifyNewGroupMRs(group, rows)
    expect(mocks.recordNotification).toHaveBeenCalledTimes(7)
    expect(mocks.recordNotification.mock.calls.map(call => call[2].id)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(mocks.addNotifiedMRId).toHaveBeenCalledTimes(7)
    expect(mocks.shown).toHaveLength(1)
    expect(mocks.shown[0].options.title).toContain('5')
    mocks.shown[0].click?.()
    expect(mocks.openExternal).toHaveBeenCalledWith('https://gitlab.test/groups/team/-/merge_requests')
  })

  it('honors quiet-time suppression for individual and grouped desktop popups', () => {
    mocks.recordNotification.mockReturnValue(false)
    notifier.notifyMRMerged(mr(1))
    notifier.notifyNewGroupMRs(group, Array.from({ length: 6 }, (_, index) => mr(index + 2)))
    expect(mocks.recordNotification).toHaveBeenCalledTimes(7)
    expect(mocks.shown).toEqual([])
  })

  it('does not repeat inbox or desktop notifications for already tracked group MRs', () => {
    mocks.getNotifiedMRIds.mockReturnValue(new Set([1, 2]))
    notifier.notifyNewGroupMRs(group, [mr(1), mr(2)])
    expect(mocks.recordNotification).not.toHaveBeenCalled()
    expect(mocks.shown).toEqual([])
  })

  it('blocks non-http(s) external URLs when opening notifications without an in-app handler', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    notifier.notifyMRMerged({ ...mr(99), webUrl: 'file:///C:/Windows/System32/calc.exe' })
    mocks.shown[0].click?.()
    expect(mocks.openExternal).not.toHaveBeenCalled()
  })
})
