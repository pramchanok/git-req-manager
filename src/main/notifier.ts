import { Notification, shell, app } from 'electron'
import path from 'path'
import type { GitLabGroup, MergeRequest } from '../shared/types'
import { addNotifiedMRId, clearNotifiedMRIds, getNotifiedMRIds, removeNotifiedMRId } from './store'
import { getAppIcon } from './app-icon'

// Lazy-initialized from persisted store so we don't re-notify after restart
let _notifiedMRIds: Set<number> | null = null
let _mrClickHandler: ((projectId: number, mrIid: number) => void) | null = null

export function setMRClickHandler(handler: (projectId: number, mrIid: number) => void) {
  _mrClickHandler = handler
}

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
      title: 'GitLab MR Manager',
      body: `${mr.author.name} requested your review: ${mr.title}`,
      icon: getAppIcon(),
      silent: false,
    })

    notification.on('click', () => {
      if (_mrClickHandler) {
        _mrClickHandler(mr.projectId, mr.iid)
      } else {
        shell.openExternal(mr.webUrl)
      }
    })

    notification.show()
  }
}

export function notifyMRMerged(mr: MergeRequest): void {
  if (!Notification.isSupported()) return

  const notification = new Notification({
    title: 'GitLab MR Manager - Merged',
    body: `"${mr.title}" ถูก merge เข้า ${mr.targetBranch} แล้ว`,
    icon: getAppIcon(),
    silent: false,
  })

  notification.on('click', () => {
    if (_mrClickHandler) {
      _mrClickHandler(mr.projectId, mr.iid)
    } else {
      shell.openExternal(mr.webUrl)
    }
  })

  notification.show()
}


export function notifyCIPipelineFailed(mrs: MergeRequest[]): void {
  for (const mr of mrs) {
    if (!Notification.isSupported()) continue

    const notification = new Notification({
      title: 'GitLab MR Manager - CI Failed',
      body: `Pipeline failed: ${mr.title}`,
      icon: getAppIcon(),
      silent: false,
    })

    notification.on('click', () => {
      if (_mrClickHandler) {
        _mrClickHandler(mr.projectId, mr.iid)
      } else {
        shell.openExternal(mr.webUrl)
      }
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
    title: 'GitLab MR Manager - Label Changed',
    body: `${mr.title}\n${parts.join(' · ')}`,
    icon: getAppIcon(),
    silent: false,
  })

  notification.on('click', () => {
    if (_mrClickHandler) {
      _mrClickHandler(mr.projectId, mr.iid)
    } else {
      shell.openExternal(mr.webUrl)
    }
  })

  notification.show()
}

export function notifyNewGroupMRs(group: GitLabGroup, newMRs: MergeRequest[]): void {
  const toNotify = newMRs.filter((mr) => !getTracked().has(mr.id))
  if (toNotify.length === 0) return

  toNotify.forEach((mr) => {
    getTracked().add(mr.id)
    addNotifiedMRId(mr.id)
  })

  if (!Notification.isSupported()) return

  if (toNotify.length > 5) {
    // Bulk summary to avoid notification spam
    const notification = new Notification({
      title: 'GitLab MR Manager',
      body: `${toNotify.length} new merge requests in ${group.name}`,
      icon: getAppIcon(),
      silent: false,
    })
    notification.on('click', () => {
      shell.openExternal(`${group.webUrl}/-/merge_requests`)
    })
    notification.show()
  } else {
    for (const mr of toNotify) {
      const notification = new Notification({
        title: `GitLab MR Manager - ${group.name}`,
        body: `${mr.author.name}: ${mr.title}`,
        icon: getAppIcon(),
        silent: false,
      })
      notification.on('click', () => {
        if (_mrClickHandler) {
          _mrClickHandler(mr.projectId, mr.iid)
        } else {
          shell.openExternal(mr.webUrl)
        }
      })
      notification.show()
    }
  }
}

export function clearTrackedMRs(): void {
  getTracked().clear()
  clearNotifiedMRIds()
}

export function removeTrackedMR(id: number): void {
  getTracked().delete(id)
  removeNotifiedMRId(id)
}

export function testNotification(): void {
  if (!Notification.isSupported()) return

  const notification = new Notification({
    title: 'GitLab MR Manager',
    body: '🎉 นี่คือการแจ้งเตือนทดสอบระบบ!\nหากคุณเห็นข้อความนี้ แปลว่าระบบแจ้งเตือนทำงานได้ปกติ',
    icon: getAppIcon(),
    silent: false,
  })

  notification.on('click', () => {
    app.focus()
  })

  notification.show()
}
