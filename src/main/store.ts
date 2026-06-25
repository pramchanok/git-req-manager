import Store from 'electron-store'
import { safeStorage } from 'electron'
import type { Settings } from '../shared/types'

interface StoreSchema {
  gitlabUrl: string
  encryptedToken: string
  refreshIntervalMinutes: number
  projectIds: number[]
  webhookEnabled: boolean
  webhookPort: number
  webhookSecret: string
  webhookPublicUrl: string
  webhookUseTunnel: boolean
  launchAtStartup: boolean
  notifyOwnerGroupIds: number[]
  notifiedMRIds: number[]
  notifiedMergedMRIds: number[]
  teamReportGroupId: number
  lastSeenVersion: string
  notifyOnMyMRMerged: boolean
}

const store = new Store<StoreSchema>({
  defaults: {
    gitlabUrl: 'https://gitlab.igenco.dev',
    encryptedToken: '',
    refreshIntervalMinutes: 5,
    projectIds: [],
    webhookEnabled: true,
    webhookPort: 3847,
    webhookSecret: '',
    webhookPublicUrl: 'https://ig-server-eoffice.igenco.dev/gitlab-webhook',
    webhookUseTunnel: false,
    launchAtStartup: false,
    notifyOwnerGroupIds: [],
    notifiedMRIds: [],
    notifiedMergedMRIds: [],
    teamReportGroupId: 0,
    lastSeenVersion: '',
    notifyOnMyMRMerged: true,
  },
})

export function getSettings(): Settings {
  const encryptedToken = store.get('encryptedToken', '')
  let accessToken = ''

  if (encryptedToken) {
    try {
      const buf = Buffer.from(encryptedToken, 'base64')
      accessToken = safeStorage.decryptString(buf)
    } catch {
      accessToken = ''
    }
  }

  return {
    gitlabUrl: store.get('gitlabUrl', 'https://gitlab.igenco.dev'),
    accessToken,
    refreshIntervalMinutes: store.get('refreshIntervalMinutes', 5),
    projectIds: store.get('projectIds', []),
    webhookEnabled: store.get('webhookEnabled', false),
    webhookPort: store.get('webhookPort', 3847),
    webhookSecret: store.get('webhookSecret', ''),
    webhookPublicUrl: store.get('webhookPublicUrl', 'https://ig-server-eoffice.igenco.dev/gitlab-webhook'),
    webhookUseTunnel: store.get('webhookUseTunnel', false),
    launchAtStartup: store.get('launchAtStartup', false),
    notifyOwnerGroupIds: store.get('notifyOwnerGroupIds', []),
    notifyOnMyMRMerged: store.get('notifyOnMyMRMerged', true),
  }
}

export function saveSettings(settings: Settings): void {
  store.set('gitlabUrl', settings.gitlabUrl)
  store.set('refreshIntervalMinutes', settings.refreshIntervalMinutes)
  store.set('projectIds', settings.projectIds)
  store.set('webhookEnabled', settings.webhookEnabled)
  store.set('webhookPort', settings.webhookPort)
  store.set('webhookSecret', settings.webhookSecret)
  store.set('webhookPublicUrl', settings.webhookPublicUrl)
  store.set('webhookUseTunnel', settings.webhookUseTunnel)
  store.set('launchAtStartup', settings.launchAtStartup)
  store.set('notifyOwnerGroupIds', settings.notifyOwnerGroupIds ?? [])
  store.set('notifyOnMyMRMerged', settings.notifyOnMyMRMerged ?? true)

  if (settings.accessToken) {
    const encrypted = safeStorage.encryptString(settings.accessToken)
    store.set('encryptedToken', encrypted.toString('base64'))
  }
}

export function isConfigured(): boolean {
  const url = store.get('gitlabUrl', '')
  const token = store.get('encryptedToken', '')
  return url.length > 0 && token.length > 0
}

export function getNotifiedMRIds(): Set<number> {
  return new Set(store.get('notifiedMRIds', []))
}

export function addNotifiedMRId(id: number): void {
  const ids = store.get('notifiedMRIds', [])
  if (!ids.includes(id)) {
    store.set('notifiedMRIds', [...ids, id])
  }
}

export function pruneNotifiedMRIds(activeIds: Set<number>): void {
  const ids = store.get('notifiedMRIds', [])
  const pruned = ids.filter((id) => activeIds.has(id)).slice(-500)
  if (pruned.length !== ids.length) {
    store.set('notifiedMRIds', pruned)
  }
}

export function removeNotifiedMRId(id: number): void {
  const ids = store.get('notifiedMRIds', [])
  store.set('notifiedMRIds', ids.filter((i) => i !== id))
}

export function clearNotifiedMRIds(): void {
  store.set('notifiedMRIds', [])
}

export function getLastSeenVersion(): string {
  return store.get('lastSeenVersion', '')
}

export function setLastSeenVersion(version: string): void {
  store.set('lastSeenVersion', version)
}


export function getTeamReportGroupId(): number | null {
  const id = store.get('teamReportGroupId', 0)
  return id > 0 ? id : null
}

export function saveTeamReportGroupId(id: number | null): void {
  store.set('teamReportGroupId', id ?? 0)
}

export function getNotifiedMergedMRIds(): Set<number> {
  return new Set(store.get('notifiedMergedMRIds', []))
}

export function hasNotifiedMergedMRId(id: number): boolean {
  return store.get('notifiedMergedMRIds', []).includes(id)
}

export function addNotifiedMergedMRId(id: number): void {
  const ids = store.get('notifiedMergedMRIds', [])
  if (!ids.includes(id)) {
    // Keep only last 500 to prevent unbounded growth
    const updated = [...ids, id].slice(-500)
    store.set('notifiedMergedMRIds', updated)
  }
}
