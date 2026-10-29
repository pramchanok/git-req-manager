import { Notification, app } from 'electron'
import type { GitLabGroup, MergeRequest } from '../shared/types'
import { addNotifiedMRId, getNotifiedMRIds } from './store'
import { recordNotification, getNotificationAccountKey } from './notification-inbox'
import { openSafeExternalUrl } from './security'

// Deduplication is persisted and scoped to the active GitLab account.
let _mrClickHandler: ((projectId: number, mrIid: number) => void) | null = null

export function setMRClickHandler(handler: (projectId: number, mrIid: number) => void) {
  _mrClickHandler = handler
}

function getTracked(): Set<number> {
  return getNotifiedMRIds()
}

function showNotification(title: string, body: string, onClick?: () => void, mr?: MergeRequest): void {
  if (!recordNotification(title, body, mr)) return
  showDesktopNotification(title, body, onClick)
}

function showDesktopNotification(title: string, body: string, onClick?: () => void): void {
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
  const accountKey = getNotificationAccountKey()
  return () => {
    if (getNotificationAccountKey() !== accountKey) return
    if (_mrClickHandler) {
      _mrClickHandler(mr.projectId, mr.iid)
    } else {
      void openSafeExternalUrl(mr.webUrl)
    }
  }
}

export function notifyNewMRs(newMRs: MergeRequest[]): void {
  for (const mr of newMRs) {
    if (getTracked().has(mr.id)) continue
    addNotifiedMRId(mr.id)

    showNotification(
      '🔔 มี MR ใหม่รอ Review',
      `${mr.author.name} ขอให้คุณช่วย Review\n!${mr.iid} · ${mr.title}`,
      openMR(mr),
      mr,
    )
  }
}

export function notifyMRMerged(mr: MergeRequest): void {
  showNotification(
    '✅ MR ถูก Merge แล้ว',
    `!${mr.iid} · ${mr.title}\nเข้า ${mr.targetBranch} แล้ว`,
    openMR(mr),
    mr,
  )
}


export function notifyCIPipelineFailed(mrs: MergeRequest[]): void {
  for (const mr of mrs) {
    showNotification(
      '❌ Pipeline ล้มเหลว',
      `!${mr.iid} · ${mr.title}`,
      openMR(mr),
      mr,
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
    mr,
  )
}

export function notifyNewGroupMRs(group: GitLabGroup, newMRs: MergeRequest[]): void {
  const toNotify = newMRs.filter((mr) => !getTracked().has(mr.id))
  if (toNotify.length === 0) return

  toNotify.forEach((mr) => {
    addNotifiedMRId(mr.id)
  })

  if (toNotify.length > 5) {
    // Keep individually actionable inbox entries, even when desktop popups are grouped.
    const visible = toNotify.filter(mr => recordNotification(`🔔 มี MR ใหม่ใน ${group.name}`, `${mr.author.name}\n!${mr.iid} · ${mr.title}`, mr))
    if (visible.length === 0) return
    showDesktopNotification(
      `👥 มี MR ใหม่ ${visible.length} รายการ`,
      `ในกลุ่ม ${group.name}\nเปิดดูรายการทั้งหมดเพื่อ Review`,
      () => void openSafeExternalUrl(`${group.webUrl}/-/merge_requests`),
    )
  } else {
    for (const mr of toNotify) {
      showNotification(
        `🔔 มี MR ใหม่ใน ${group.name}`,
        `${mr.author.name} ขอให้คุณช่วย Review\n!${mr.iid} · ${mr.title}`,
        openMR(mr),
        mr,
      )
    }
  }
}

export function testNotification(): void {
  showDesktopNotification(
    '🔔 ทดสอบ Notification',
    'ระบบแจ้งเตือนทำงานปกติ',
    () => app.focus(),
  )
}
