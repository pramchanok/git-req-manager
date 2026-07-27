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
  localRepoPaths: Record<string, string>
  hasRunBefore: boolean
  launchAtStartupDefaultApplied: boolean
}

// แหล่งความจริงเดียวของค่า default — ทั้ง electron-store และ fallback ของ getSettings()
// ใช้ชุดนี้ร่วมกัน เพื่อไม่ให้สองที่หลุดจากกัน (เคยมีเคส webhookEnabled true/false ไม่ตรงกัน)
const DEFAULTS: StoreSchema = {
  gitlabUrl: 'https://gitlab.igenco.dev',
  encryptedToken: '',
  refreshIntervalMinutes: 5,
  projectIds: [],
  webhookEnabled: true,
  webhookPort: 3847,
  webhookSecret: '',
  webhookPublicUrl: 'https://ig-server-eoffice.igenco.dev/gitlab-webhook',
  webhookUseTunnel: false,
  launchAtStartup: true,
  notifyOwnerGroupIds: [],
  notifiedMRIds: [],
  notifiedMergedMRIds: [],
  teamReportGroupId: 0,
  lastSeenVersion: '',
  notifyOnMyMRMerged: true,
  localRepoPaths: {},
  hasRunBefore: false,
  launchAtStartupDefaultApplied: false,
}

const store = new Store<StoreSchema>({ defaults: DEFAULTS })

function read<K extends keyof StoreSchema>(key: K): StoreSchema[K] {
  return store.get(key, DEFAULTS[key]) as StoreSchema[K]
}

// ── One-time migration: เปลี่ยน default ของ "เริ่มพร้อมเปิดเครื่อง" เป็นเปิด ──
// ครอบคลุมเครื่องที่ติดตั้งอยู่แล้ว (ซึ่งมีค่า false บันทึกไว้) — ทำครั้งเดียว
// หลังจากนั้นผู้ใช้ยังปิดเองได้ตามปกติ
if (!read('launchAtStartupDefaultApplied')) {
  store.set('launchAtStartup', true)
  store.set('launchAtStartupDefaultApplied', true)
}

const PLAIN_TOKEN_PREFIX = 'plain:'

// เพดานจำนวน MR id ที่จำไว้กันแจ้งเตือนซ้ำ — กันไฟล์ config โตไม่จำกัด
const MAX_TRACKED_IDS = 500

function decryptAccessToken(): string {
  const encryptedToken = read('encryptedToken')
  if (!encryptedToken) return ''

  if (encryptedToken.startsWith(PLAIN_TOKEN_PREFIX)) {
    // Fallback storage: OS keychain ไม่พร้อมใช้งานตอนบันทึก (เช่น Linux ไม่มี keyring)
    return Buffer.from(encryptedToken.slice(PLAIN_TOKEN_PREFIX.length), 'base64').toString('utf-8')
  }

  try {
    return safeStorage.decryptString(Buffer.from(encryptedToken, 'base64'))
  } catch {
    return ''
  }
}

export function getSettings(): Settings {
  return {
    gitlabUrl: read('gitlabUrl'),
    accessToken: decryptAccessToken(),
    refreshIntervalMinutes: read('refreshIntervalMinutes'),
    projectIds: read('projectIds'),
    webhookEnabled: read('webhookEnabled'),
    webhookPort: read('webhookPort'),
    webhookSecret: read('webhookSecret'),
    webhookPublicUrl: read('webhookPublicUrl'),
    webhookUseTunnel: read('webhookUseTunnel'),
    launchAtStartup: read('launchAtStartup'),
    notifyOwnerGroupIds: read('notifyOwnerGroupIds'),
    notifyOnMyMRMerged: read('notifyOnMyMRMerged'),
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
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(settings.accessToken)
      store.set('encryptedToken', encrypted.toString('base64'))
    } else {
      // OS keychain ไม่พร้อมใช้งาน (เช่น Linux ที่ไม่มี keyring) — เก็บแบบ base64
      // เพื่อไม่ให้ save ล้มเหลวเงียบๆ (encryptString จะ throw)
      console.warn('[store] safeStorage unavailable — storing token base64-encoded (not encrypted)')
      store.set('encryptedToken', PLAIN_TOKEN_PREFIX + Buffer.from(settings.accessToken, 'utf-8').toString('base64'))
    }
  }
  // หมายเหตุ: token ว่างจะ "ไม่" ล้างค่าเดิม เพื่อกันเคส decrypt fail ชั่วคราว
  // แล้ว save ทับจนหาย — ใช้ clearAccessToken() เมื่อต้องการ logout จริงๆ
}

/**
 * ต้อง "ถอดรหัสได้จริง" ถึงจะนับว่าตั้งค่าแล้ว — ถ้าเช็คแค่ว่ามีสตริงใน encryptedToken
 * เคสที่ safeStorage ถอดรหัสไม่ผ่าน (ย้ายเครื่อง / keychain เปลี่ยน) จะผ่านด่านนี้ไปได้
 * แล้วยิง GitLab ด้วย token ว่างจนได้ 401 รัวๆ โดยผู้ใช้ไม่รู้ว่าต้องไปใส่ token ใหม่
 */
export function isConfigured(): boolean {
  return read('gitlabUrl').length > 0 && decryptAccessToken().length > 0
}

export function getNotifiedMRIds(): Set<number> {
  return new Set(read('notifiedMRIds'))
}

export function addNotifiedMRId(id: number): void {
  const ids = read('notifiedMRIds')
  if (!ids.includes(id)) {
    store.set('notifiedMRIds', [...ids, id].slice(-MAX_TRACKED_IDS))
  }
}

export function pruneNotifiedMRIds(activeIds: Set<number>): void {
  const ids = read('notifiedMRIds')
  const pruned = ids.filter((id) => activeIds.has(id)).slice(-MAX_TRACKED_IDS)
  if (pruned.length !== ids.length) {
    store.set('notifiedMRIds', pruned)
  }
}

export function getLastSeenVersion(): string {
  return read('lastSeenVersion')
}

export function setLastSeenVersion(version: string): void {
  store.set('lastSeenVersion', version)
}


export function getTeamReportGroupId(): number | null {
  const id = read('teamReportGroupId')
  return id > 0 ? id : null
}

export function saveTeamReportGroupId(id: number | null): void {
  store.set('teamReportGroupId', id ?? 0)
}

export function getLocalRepoPath(projectKey: string): string | null {
  const repoPath = read('localRepoPaths')[projectKey]
  return typeof repoPath === 'string' && repoPath.length > 0 ? repoPath : null
}

export function saveLocalRepoPath(projectKey: string, repoPath: string): void {
  store.set('localRepoPaths', { ...read('localRepoPaths'), [projectKey]: repoPath })
}

export function hasNotifiedMergedMRId(id: number): boolean {
  return read('notifiedMergedMRIds').includes(id)
}

export function addNotifiedMergedMRId(id: number): void {
  const ids = read('notifiedMergedMRIds')
  if (!ids.includes(id)) {
    store.set('notifiedMergedMRIds', [...ids, id].slice(-MAX_TRACKED_IDS))
  }
}

/** หมายเหตุ: มี side effect — เรียกครั้งแรกจะ mark ว่ารันแล้ว จึงคืน true ได้ครั้งเดียว */
export function isFirstRun(): boolean {
  if (read('hasRunBefore')) return false
  store.set('hasRunBefore', true)
  return true
}
