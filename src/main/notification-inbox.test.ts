import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotificationInboxState } from '../shared/types'

const mocks = vi.hoisted(() => ({
  data: { accounts: {} as Record<string, NotificationInboxState & { updatedAt: number }> },
  getSettings: vi.fn(),
}))
vi.mock('electron-store', () => ({ default: class {
  get(key: 'accounts') { return structuredClone(mocks.data[key]) }
  set(key: 'accounts', value: typeof mocks.data.accounts) { mocks.data[key] = structuredClone(value) }
} }))
vi.mock('./store', () => ({ getSettings: mocks.getSettings }))

let inbox: typeof import('./notification-inbox')
beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 8, 19, 12))
  mocks.data.accounts = {}
  mocks.getSettings.mockReturnValue({ quietHours: { enabled: false, start: '22:00', end: '08:00' } })
  inbox = await import('./notification-inbox')
})
afterEach(() => vi.useRealTimers())

describe('notification inbox', () => {
  it('isolates accounts and hosts and exposes nothing when disconnected', () => {
    inbox.setNotificationScope('https://gitlab.test/', 1)
    inbox.recordNotification('Account one', 'First')
    inbox.setNotificationScope('https://gitlab.test', 2)
    expect(inbox.getNotificationState().entries).toEqual([])
    inbox.recordNotification('Account two', 'Second')
    inbox.setNotificationScope('https://other.test', 1)
    expect(inbox.getNotificationState().entries).toEqual([])
    inbox.setNotificationScope('https://gitlab.test', 1)
    expect(inbox.getNotificationState().entries.map(entry => entry.title)).toEqual(['Account one'])
    inbox.setNotificationScope(null, null)
    inbox.recordNotification('No account', 'Not persisted')
    expect(inbox.getNotificationState()).toEqual({ entries: [], snoozed: {} })
    expect(Object.keys(mocks.data.accounts)).toHaveLength(2)
  })
  it('retains the newest 200 entries and ten most recently updated accounts', () => {
    inbox.setNotificationScope('https://gitlab.test', 1)
    for (let i = 0; i < 205; i++) inbox.recordNotification(`Event ${i}`, 'Body')
    const entries = inbox.getNotificationState().entries
    expect(entries).toHaveLength(200)
    expect(entries[0].title).toBe('Event 204')
    expect(entries.at(-1)?.title).toBe('Event 5')
    for (let id = 2; id <= 11; id++) {
      vi.advanceTimersByTime(1)
      inbox.setNotificationScope('https://gitlab.test', id)
      inbox.recordNotification('Account event', 'Body')
    }
    expect(Object.keys(mocks.data.accounts)).toHaveLength(10)
    inbox.setNotificationScope('https://gitlab.test', 1)
    expect(inbox.getNotificationState().entries).toEqual([])
  })
  it('snoozes only the matching MR popup while retaining its inbox entry', () => {
    inbox.setNotificationScope('https://gitlab.test', 1)
    inbox.snoozeNotification(10, 2, 60)
    expect(inbox.recordNotification('Snoozed', 'Body', { projectId: 10, iid: 2 })).toBe(false)
    expect(inbox.getNotificationState().entries[0]).toMatchObject({ title: 'Snoozed', read: false, projectId: 10, mrIid: 2 })
    expect(inbox.getNotificationState().entries[0].snoozedUntil).toBeTruthy()
    expect(inbox.recordNotification('Other MR', 'Body', { projectId: 10, iid: 3 })).toBe(true)
    vi.advanceTimersByTime(60 * 60_000)
    expect(inbox.recordNotification('Expired', 'Body', { projectId: 10, iid: 2 })).toBe(true)
    expect(inbox.getNotificationState().snoozed).toEqual({})
    expect(inbox.getNotificationState().entries).toHaveLength(3)
  })
  it('supports day snooze, explicit unsnooze and account isolation', () => {
    inbox.setNotificationScope('https://gitlab.test', 1)
    inbox.snoozeNotification(10, 2, 1440)
    expect(Date.parse(inbox.getNotificationState().snoozed['10:2']) - Date.now()).toBe(24 * 60 * 60_000)
    inbox.setNotificationScope('https://gitlab.test', 2)
    expect(inbox.recordNotification('Other account', 'Body', { projectId: 10, iid: 2 })).toBe(true)
    inbox.setNotificationScope('https://gitlab.test', 1)
    inbox.snoozeNotification(10, 2, 0)
    expect(inbox.recordNotification('Resumed', 'Body', { projectId: 10, iid: 2 })).toBe(true)
  })
  it('quiet hours suppress only the popup and mark read affects only the current account', () => {
    mocks.getSettings.mockReturnValue({ quietHours: { enabled: true, start: '22:00', end: '08:00' } })
    vi.setSystemTime(new Date(2026, 8, 19, 23))
    inbox.setNotificationScope('https://gitlab.test', 1)
    const changed = vi.fn()
    inbox.onInboxChanged(changed)
    expect(inbox.recordNotification('Late event', 'Body')).toBe(false)
    expect(inbox.getNotificationState().entries[0].read).toBe(false)
    inbox.setNotificationScope('https://gitlab.test', 2)
    inbox.recordNotification('Another account', 'Body')
    inbox.markNotificationsRead()
    expect(inbox.getNotificationState().entries[0].read).toBe(true)
    inbox.setNotificationScope('https://gitlab.test', 1)
    expect(inbox.getNotificationState().entries[0].read).toBe(false)
    expect(changed).toHaveBeenCalled()
  })
  it.each([[0, 1, 60], [-1, 1, 60], [1.5, 1, 60], [1, 0, 60], [1, NaN, 60], [1, 1, -1], [1, 1, 30], [1, 1, Infinity]])('rejects invalid snooze (%s, %s, %s) without writing', (project, mr, minutes) => {
    inbox.setNotificationScope('https://gitlab.test', 1)
    expect(() => inbox.snoozeNotification(project, mr, minutes)).toThrow('Invalid snooze request')
    expect(mocks.data.accounts).toEqual({})
  })
})
