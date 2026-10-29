import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const nativeUpdater = (() => {
    const listeners = new Map<string, Array<(...args: any[]) => void>>()
    return {
      on(event: string, fn: (...args: any[]) => void) {
        listeners.set(event, [...(listeners.get(event) ?? []), fn])
        return this
      },
      once(event: string, fn: (...args: any[]) => void) {
        const wrapper = (...args: any[]) => {
          listeners.set(event, (listeners.get(event) ?? []).filter((l) => l !== wrapper))
          fn(...args)
        }
        return this.on(event, wrapper)
      },
      emit(event: string, ...args: any[]) {
        for (const fn of [...(listeners.get(event) ?? [])]) fn(...args)
      },
      removeAllListeners() {
        listeners.clear()
      },
    }
  })()
  const updaterEvents = (() => {
    const listeners = new Map<string, Array<(...args: any[]) => void>>()
    return {
      on(event: string, fn: (...args: any[]) => void) {
        listeners.set(event, [...(listeners.get(event) ?? []), fn])
        return this
      },
      emit(event: string, ...args: any[]) {
        for (const fn of [...(listeners.get(event) ?? [])]) fn(...args)
      },
      removeAllListeners() {
        listeners.clear()
      },
    }
  })()
  return {
    nativeUpdater,
    updaterEvents,
    checkForUpdates: vi.fn(),
    quitAndInstall: vi.fn(),
    getAllWindows: vi.fn<() => Array<{ isDestroyed: () => boolean; destroy: () => void }>>(() => []),
  }
})

vi.mock('electron', () => ({
  app: {
    getVersion: () => '1.15.2',
    isPackaged: true,
  },
  autoUpdater: mocks.nativeUpdater,
  BrowserWindow: {
    getAllWindows: mocks.getAllWindows,
  },
  Notification: class {
    static isSupported() {
      return false
    }
    on() {}
    show() {}
  },
}))

vi.mock('electron-updater', () => ({
  autoUpdater: Object.assign(mocks.updaterEvents, {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    checkForUpdates: mocks.checkForUpdates,
    quitAndInstall: mocks.quitAndInstall,
  }),
}))

let updater: typeof import('./updater')

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.nativeUpdater.removeAllListeners()
  mocks.updaterEvents.removeAllListeners()
  mocks.checkForUpdates.mockResolvedValue(null)
  updater = await import('./updater')
})

describe('updater install lifecycle', () => {
  it('throws when trying to install before an update is downloaded', () => {
    expect(() => updater.installDownloadedUpdate()).toThrow('No downloaded update is ready to install.')
    expect(mocks.quitAndInstall).not.toHaveBeenCalled()
  })

  it('runs pre-install shutdown callback before quitAndInstall and destroys open windows on before-quit-for-update', () => {
    const callOrder: string[] = []
    mocks.quitAndInstall.mockImplementation(() => {
      callOrder.push('quitAndInstall')
    })

    const activeWin = { isDestroyed: () => false, destroy: vi.fn(() => callOrder.push('destroyWin')) }
    const destroyedWin = { isDestroyed: () => true, destroy: vi.fn() }
    mocks.getAllWindows.mockReturnValue([activeWin, destroyedWin])

    updater.initializeUpdater()
    updater.setBeforeInstallCallback(() => {
      callOrder.push('beforeInstall')
    })

    mocks.updaterEvents.emit('update-downloaded', {
      version: '1.15.3',
      releaseDate: '2026-10-29T00:00:00.000Z',
      releaseNotes: 'Fixes updater teardown',
    })

    updater.installDownloadedUpdate()

    expect(callOrder).toEqual(['beforeInstall', 'quitAndInstall'])
    expect(mocks.quitAndInstall).toHaveBeenCalledExactlyOnceWith(false, true)

    mocks.nativeUpdater.emit('before-quit-for-update')

    expect(activeWin.destroy).toHaveBeenCalledOnce()
    expect(destroyedWin.destroy).not.toHaveBeenCalled()
    expect(callOrder).toEqual(['beforeInstall', 'quitAndInstall', 'destroyWin'])

    updater.stopUpdater()
  })
})
