import Store from 'electron-store'
import crypto from 'crypto'
import type { NotificationEntry, NotificationInboxState } from '../shared/types'
import { getSettings } from './store'
import { isQuietTime } from '../shared/notificationPolicy'

type AccountInbox = NotificationInboxState & { updatedAt: number }
const store = new Store<{ accounts: Record<string, AccountInbox> }>({ name: 'notification-inbox', defaults: { accounts: {} } })
let scope: string | null = null
let changed: () => void = () => {}

export function onInboxChanged(callback: () => void): void { changed = callback }
export function getNotificationAccountKey(): string | null { return scope }

export function setNotificationScope(host: string | null, userId: number | null): void {
  const url = host ? new URL(host) : null
  const next = url && userId ? `${url.origin}${url.pathname.replace(/\/+$/, '')}:${userId}` : null
  if (next === scope) return
  scope = next
  changed()
}

export function getNotificationState(): NotificationInboxState {
  const account = scope ? store.get('accounts')[scope] : undefined
  return { entries: account?.entries ?? [], snoozed: account?.snoozed ?? {} }
}

function save(state: NotificationInboxState): void {
  if (!scope) return
  const accounts = store.get('accounts')
  accounts[scope] = { ...state, entries: state.entries.slice(0, 200), updatedAt: Date.now() }
  const retained = Object.fromEntries(Object.entries(accounts).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 10))
  store.set('accounts', retained)
  changed()
}

/** Save first; quiet hours and snooze suppress only the desktop popup. */
export function recordNotification(title: string, body: string, mr?: { projectId: number; iid: number }): boolean {
  const state = getNotificationState()
  const now = Date.now()
  state.snoozed = Object.fromEntries(Object.entries(state.snoozed).filter(([, until]) => Date.parse(until) > now))
  const key = mr ? `${mr.projectId}:${mr.iid}` : null
  const until = key ? state.snoozed[key] : undefined
  const entry: NotificationEntry = {
    id: crypto.randomUUID(), title, body, createdAt: new Date(now).toISOString(), read: false,
    ...(mr ? { projectId: mr.projectId, mrIid: mr.iid } : {}),
    ...(until ? { snoozedUntil: until } : {}),
  }
  save({ ...state, entries: [entry, ...state.entries] })
  return !until && !isQuietTime(getSettings().quietHours)
}

export function markNotificationsRead(): void {
  const state = getNotificationState()
  save({ ...state, entries: state.entries.map(entry => ({ ...entry, read: true })) })
}

export function snoozeNotification(projectId: number, mrIid: number, minutes: number): void {
  if (!Number.isSafeInteger(projectId) || projectId <= 0 || !Number.isSafeInteger(mrIid) || mrIid <= 0 || ![0, 60, 1440].includes(minutes)) throw new Error('Invalid snooze request')
  const state = getNotificationState()
  const key = `${projectId}:${mrIid}`
  if (minutes === 0) delete state.snoozed[key]
  else state.snoozed[key] = new Date(Date.now() + minutes * 60_000).toISOString()
  save(state)
}
