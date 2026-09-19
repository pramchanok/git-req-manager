import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Settings } from '../shared/types'

const mocks = vi.hoisted(() => ({
  persisted: {} as Record<string, unknown>,
  set: vi.fn(), isEncryptionAvailable: vi.fn(), getSelectedStorageBackend: vi.fn(),
  encryptString: vi.fn(), decryptString: vi.fn(),
}))

vi.mock('electron', () => ({ safeStorage: mocks }))
vi.mock('electron-store', () => ({
  default: class {
    constructor({ defaults }: { defaults: Record<string, unknown> }) {
      mocks.persisted = { ...structuredClone(defaults), ...mocks.persisted }
    }
    get(key: string, fallback: unknown) { return structuredClone(mocks.persisted[key] ?? fallback) }
    set(key: string, value: unknown) { mocks.set(key, value); mocks.persisted[key] = structuredClone(value) }
  },
}))

let store: typeof import('./store')
function settings(accessToken = 'test-token'): Settings {
  return {
    gitlabUrl: 'https://gitlab.test', accessToken, refreshIntervalMinutes: 5,
    projectIds: [], webhookEnabled: false, webhookPort: 3847, webhookSecret: '', webhookPublicUrl: '',
    webhookUseTunnel: false, launchAtStartup: false, notifyOwnerGroupIds: [], notifyOnMyMRMerged: true,
  }
}

beforeEach(async () => {
  vi.resetModules()
  vi.resetAllMocks()
  mocks.persisted = { launchAtStartupDefaultApplied: true }
  mocks.isEncryptionAvailable.mockReturnValue(true)
  mocks.getSelectedStorageBackend.mockReturnValue('gnome_libsecret')
  mocks.encryptString.mockImplementation((value: string) => Buffer.from(`encrypted:${value}`))
  mocks.decryptString.mockImplementation((value: Buffer) => value.toString().replace(/^encrypted:/, ''))
  store = await import('./store')
})

afterEach(() => vi.restoreAllMocks())

describe('access token persistence', () => {
  test('stores only OS-encrypted bytes when secure storage is available', () => {
    store.saveSettings(settings())
    expect(mocks.persisted.encryptedToken).toBe(Buffer.from('encrypted:test-token').toString('base64'))
    expect(mocks.encryptString).toHaveBeenCalledWith('test-token')
    expect(store.getSettings()).toMatchObject({ accessToken: 'test-token', tokenStorage: 'encrypted' })
  })

  test('keeps token only in memory when secure storage is unavailable, including across blank saves', async () => {
    mocks.isEncryptionAvailable.mockReturnValue(false)
    store.saveSettings(settings())
    store.saveSettings(settings(''))
    expect(mocks.encryptString).not.toHaveBeenCalled()
    expect(mocks.persisted.encryptedToken).toBe('')
    expect(JSON.stringify(mocks.persisted)).not.toContain('test-token')
    expect(JSON.stringify(mocks.persisted)).not.toContain(Buffer.from('test-token').toString('base64'))
    expect(store.getSettings()).toMatchObject({ accessToken: 'test-token', tokenStorage: 'session' })
    expect(store.isConfigured()).toBe(true)

    vi.resetModules()
    const restarted = await import('./store')
    expect(restarted.getSettings()).toMatchObject({ accessToken: '', tokenStorage: 'missing' })
    expect(restarted.isConfigured()).toBe(false)
  })

  test('treats the Linux basic_text backend as insecure even if encryption is reported available', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    mocks.getSelectedStorageBackend.mockReturnValue('basic_text')
    store.saveSettings(settings())
    expect(mocks.encryptString).not.toHaveBeenCalled()
    expect(mocks.persisted.encryptedToken).toBe('')
    expect(store.getSettings().tokenStorage).toBe('session')
  })

  test.each([true, false])('migrates a legacy Base64 token with secure storage available=%s', (available) => {
    mocks.isEncryptionAvailable.mockReturnValue(available)
    mocks.persisted.encryptedToken = `plain:${Buffer.from('legacy-token').toString('base64')}`
    expect(store.getSettings().accessToken).toBe('legacy-token')
    expect(mocks.persisted.encryptedToken).toBe(available ? Buffer.from('encrypted:legacy-token').toString('base64') : '')
    expect(store.getSettings().tokenStorage).toBe(available ? 'encrypted' : 'session')
  })

  test('blank settings preserve an existing encrypted token', () => {
    store.saveSettings(settings())
    const encrypted = mocks.persisted.encryptedToken
    store.saveSettings(settings(''))
    expect(mocks.persisted.encryptedToken).toBe(encrypted)
    expect(store.getSettings().accessToken).toBe('test-token')
  })

  test('does not change hosts or replace stored credentials when encryption throws', () => {
    store.saveSettings(settings())
    const encrypted = mocks.persisted.encryptedToken
    mocks.encryptString.mockImplementation(() => { throw new Error('keychain locked') })
    expect(() => store.saveSettings({ ...settings('replacement'), gitlabUrl: 'https://other.test' })).toThrow('keychain locked')
    expect(mocks.persisted.gitlabUrl).toBe('https://gitlab.test')
    expect(mocks.persisted.encryptedToken).toBe(encrypted)
  })
})

describe('notification identity isolation', () => {
  test('isolates review and merged IDs by both host and authenticated user', () => {
    store.setNotificationIdentity('https://gitlab.test/', 1)
    store.addNotifiedMRId(7)
    store.addNotifiedMergedMRId(8)
    store.setNotificationIdentity('https://other.test', 1)
    expect(store.getNotifiedMRIds()).toEqual(new Set())
    expect(store.hasNotifiedMergedMRId(8)).toBe(false)
    store.addNotifiedMRId(9)
    store.setNotificationIdentity('https://gitlab.test', 2)
    expect(store.getNotifiedMRIds()).toEqual(new Set())
    expect(store.hasNotifiedMergedMRId(8)).toBe(false)
    store.setNotificationIdentity('https://gitlab.test', 1)
    expect(store.getNotifiedMRIds()).toEqual(new Set([7]))
    expect(store.hasNotifiedMergedMRId(8)).toBe(true)
    store.setNotificationIdentity(null, null)
    expect(store.getNotifiedMRIds()).toEqual(new Set())
    expect(store.hasNotifiedMergedMRId(8)).toBe(false)
  })

  test('prunes only the current account and retains merged IDs', () => {
    store.setNotificationIdentity('https://gitlab.test', 1)
    store.addNotifiedMRId(1)
    store.addNotifiedMRId(2)
    store.addNotifiedMergedMRId(3)
    store.setNotificationIdentity('https://gitlab.test', 2)
    store.addNotifiedMRId(4)
    store.setNotificationIdentity('https://gitlab.test', 1)
    store.pruneNotifiedMRIds(new Set([2]))
    expect(store.getNotifiedMRIds()).toEqual(new Set([2]))
    expect(store.hasNotifiedMergedMRId(3)).toBe(true)
    store.setNotificationIdentity('https://gitlab.test', 2)
    expect(store.getNotifiedMRIds()).toEqual(new Set([4]))
  })
})
