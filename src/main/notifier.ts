import { Notification, shell } from 'electron'
import type { MergeRequest } from '../shared/types'
import { addNotifiedMRId, clearNotifiedMRIds, getNotifiedMRIds, removeNotifiedMRId } from './store'

// Lazy-initialized from persisted store so we don't re-notify after restart
let _notifiedMRIds: Set<number> | null = null

function getTracked(): Set<number> {
  if (!_notifiedMRIds) _notifiedMRIds = getNotifiedMRIds()
  return _notifiedMRIds
}

export function notifyNewMRs(newMRs: MergeRequest[]): void {
  for (const mr of newMRs) {
    if (getTracked().has(mr.id)) continue
    getTracked().add(mr.id)
    addNotifiedMRId(mr.id)

    if (!Notification.isSupported()) continue

    const notification = new Notification({
      title: '🔔 GitLab MR Manager',
      body: `${mr.author.name} requested your review: ${mr.title}`,
      silent: false,
    })

    notification.on('click', () => {
      shell.openExternal(mr.webUrl)
    })

    notification.show()
  }
}

export function notifyCIPipelineFailed(mrs: MergeRequest[]): void {
  for (const mr of mrs) {
    if (!Notification.isSupported()) continue

    const notification = new Notification({
      title: '🔴 GitLab CI Failed',
      body: `Pipeline failed: ${mr.title}`,
      silent: false,
    })

    notification.on('click', () => {
      shell.openExternal(mr.webUrl)
    })

    notification.show()
  }
}

export function notifyLabelsChanged(mr: MergeRequest, added: string[], removed: string[]): void {
  if (!Notification.isSupported()) return

  const parts: string[] = []
  if (added.length > 0) parts.push(`+ ${added.join(', ')}`)
  if (removed.length > 0) parts.push(`- ${removed.join(', ')}`)

  const notification = new Notification({
    title: '🏷️ Label Changed',
    body: `${mr.title}\n${parts.join(' · ')}`,
    silent: false,
  })

  notification.on('click', () => {
    shell.openExternal(mr.webUrl)
  })

  notification.show()
}

export function clearTrackedMRs(): void {
  getTracked().clear()
  clearNotifiedMRIds()
}

export function removeTrackedMR(id: number): void {
  getTracked().delete(id)
  removeNotifiedMRId(id)
}
