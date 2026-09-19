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
  quietHours: { enabled: boolean; start: string; end: string }
  notificationAccounts: Record<string, { review: number[]; merged: number[] }>
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
  quietHours: { enabled: false, start: '22:00', end: '08:00' },
  notificationAccounts: {},
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
let sessionToken: string | null = null

function secureStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable() &&
    (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text')
}

function persistToken(token: string): void {
  if (secureStorageAvailable()) {
    const encrypted = safeStorage.encryptString(token)
    store.set('encryptedToken', encrypted.toString('base64'))
    sessionToken = null
  } else {
    sessionToken = token
    store.set('encryptedToken', '')
  }
}

// เพดานจำนวน MR id ที่จำไว้กันแจ้งเตือนซ้ำ — กันไฟล์ config โตไม่จำกัด
const MAX_TRACKED_IDS = 500
let notificationAccount: string | null = null

export function setNotificationIdentity(host: string | null, userId: number | null): void {
  const url = host ? new URL(host) : null
  notificationAccount = url && userId ? `${url.origin}${url.pathname.replace(/\/+$/, '')}:${userId}` : null
}

function readNotificationIds(kind: 'review' | 'merged'): number[] {
  if (!notificationAccount) return []
  return read('notificationAccounts')[notificationAccount]?.[kind] ?? []
}

function writeNotificationIds(kind: 'review' | 'merged', ids: number[]): void {
  if (!notificationAccount) return
  const accounts = read('notificationAccounts')
  const entry = accounts[notificationAccount] ?? { review: [], merged: [] }
  delete accounts[notificationAccount]
  const retained = Object.fromEntries(Object.entries(accounts).slice(-9))
  retained[notificationAccount] = { ...entry, [kind]: ids.slice(-MAX_TRACKED_IDS) }
  store.set('notificationAccounts', retained)
}

function decryptAccessToken(): string {
  if (sessionToken !== null) return sessionToken
  const encryptedToken = read('encryptedToken')
  if (!encryptedToken) return ''

  if (encryptedToken.startsWith(PLAIN_TOKEN_PREFIX)) {
    const token = Buffer.from(encryptedToken.slice(PLAIN_TOKEN_PREFIX.length), 'base64').toString('utf-8')
    persistToken(token)
    return token
  }

  try {
    const token = safeStorage.decryptString(Buffer.from(encryptedToken, 'base64'))
    if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') persistToken(token)
    return token
  } catch {
    return ''
  }
}

export function getSettings(): Settings {
  const accessToken = decryptAccessToken()
  return {
    gitlabUrl: read('gitlabUrl'),
    accessToken,
    tokenStorage: accessToken ? (sessionToken !== null ? 'session' : 'encrypted') : 'missing',
    quietHours: read('quietHours'),
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
  // Encrypt before saving the remaining settings so a keychain error does not
  // silently bind the old credential to a new GitLab host.
  if (settings.accessToken) persistToken(settings.accessToken)
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
  if (settings.quietHours) store.set('quietHours', settings.quietHours)

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
  return new Set(readNotificationIds('review'))
}

export function addNotifiedMRId(id: number): void {
  const ids = readNotificationIds('review')
  if (!ids.includes(id)) {
    writeNotificationIds('review', [...ids, id])
  }
}

export function pruneNotifiedMRIds(activeIds: Set<number>): void {
  const ids = readNotificationIds('review')
  const pruned = ids.filter((id) => activeIds.has(id)).slice(-MAX_TRACKED_IDS)
  if (pruned.length !== ids.length) {
    writeNotificationIds('review', pruned)
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
  return readNotificationIds('merged').includes(id)
}

export function addNotifiedMergedMRId(id: number): void {
  const ids = readNotificationIds('merged')
  if (!ids.includes(id)) {
    writeNotificationIds('merged', [...ids, id])
  }
}

/** หมายเหตุ: มี side effect — เรียกครั้งแรกจะ mark ว่ารันแล้ว จึงคืน true ได้ครั้งเดียว */
export function isFirstRun(): boolean {
  if (read('hasRunBefore')) return false
  store.set('hasRunBefore', true)
  return true
}
