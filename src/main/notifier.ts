import { Notification, shell, app } from 'electron'
import type { GitLabGroup, MergeRequest } from '../shared/types'
import { addNotifiedMRId, getNotifiedMRIds } from './store'

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

function showNotification(title: string, body: string, onClick?: () => void): void {
  if (!Notification.isSupported()) return

  const notification = new Notification({
    title,
    body,
    silent: false,
  })

  if (onClick) notification.on('click', onClick)
  notification.show()
}

function openMR(mr: MergeRequest): () => void {
  return () => {
    if (_mrClickHandler) {
      _mrClickHandler(mr.projectId, mr.iid)
    } else {
      shell.openExternal(mr.webUrl)
    }
  }
}

export function notifyNewMRs(newMRs: MergeRequest[]): void {
  for (const mr of newMRs) {
    if (getTracked().has(mr.id)) continue
    getTracked().add(mr.id)
    addNotifiedMRId(mr.id)

    showNotification(
      '🔔 มี MR ใหม่รอ Review',
      `${mr.author.name} ขอให้คุณช่วย Review\n!${mr.iid} · ${mr.title}`,
      openMR(mr),
    )
  }
}

export function notifyMRMerged(mr: MergeRequest): void {
  showNotification(
    '✅ MR ถูก Merge แล้ว',
    `!${mr.iid} · ${mr.title}\nเข้า ${mr.targetBranch} แล้ว`,
    openMR(mr),
  )
}


export function notifyCIPipelineFailed(mrs: MergeRequest[]): void {
  for (const mr of mrs) {
    showNotification(
      '❌ Pipeline ล้มเหลว',
      `!${mr.iid} · ${mr.title}`,
      openMR(mr),
    )
  }
}

export function notifyLabelsChanged(mr: MergeRequest, added: string[], removed: string[]): void {
  const parts: string[] = []
  if (added.length > 0) parts.push(`เพิ่ม: ${added.join(', ')}`)
  if (removed.length > 0) parts.push(`ลบ: ${removed.join(', ')}`)

  showNotification(
    '🏷️ Label ถูกเปลี่ยน',
    `!${mr.iid} · ${mr.title}\n${parts.join(' · ')}`,
    openMR(mr),
  )
}

export function notifyNewGroupMRs(group: GitLabGroup, newMRs: MergeRequest[]): void {
  const toNotify = newMRs.filter((mr) => !getTracked().has(mr.id))
  if (toNotify.length === 0) return

  toNotify.forEach((mr) => {
    getTracked().add(mr.id)
    addNotifiedMRId(mr.id)
  })

  if (toNotify.length > 5) {
    // Bulk summary to avoid notification spam
    showNotification(
      `👥 มี MR ใหม่ ${toNotify.length} รายการ`,
      `ในกลุ่ม ${group.name}\nเปิดดูรายการทั้งหมดเพื่อ Review`,
      () => shell.openExternal(`${group.webUrl}/-/merge_requests`),
    )
  } else {
    for (const mr of toNotify) {
      showNotification(
        `🔔 มี MR ใหม่ใน ${group.name}`,
        `${mr.author.name} ขอให้คุณช่วย Review\n!${mr.iid} · ${mr.title}`,
        openMR(mr),
      )
    }
  }
}

export function testNotification(): void {
  showNotification(
    '🔔 ทดสอบ Notification',
    'ระบบแจ้งเตือนทำงานปกติ',
    () => app.focus(),
  )
}
