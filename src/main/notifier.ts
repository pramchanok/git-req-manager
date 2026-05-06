import { Notification, shell } from 'electron'
import type { MergeRequest } from '../shared/types'

const notifiedMRIds = new Set<number>()

export function notifyNewMRs(newMRs: MergeRequest[]): void {
  for (const mr of newMRs) {
    if (notifiedMRIds.has(mr.id)) continue
    notifiedMRIds.add(mr.id)

    if (!Notification.isSupported()) continue

    const notification = new Notification({
      title: '🔔 GitLab MR Manager',
      body: `${mr.author.name} opened: ${mr.title}`,
      silent: false,
    })

    notification.on('click', () => {
      shell.openExternal(mr.webUrl)
    })

    notification.show()
  }
}

export function clearTrackedMRs(): void {
  notifiedMRIds.clear()
}

export function removeTrackedMR(id: number): void {
  notifiedMRIds.delete(id)
}
