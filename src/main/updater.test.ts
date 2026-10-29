import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
const originalAppImage = process.env.APPIMAGE

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  delete process.env.APPIMAGE
  mocks.nativeUpdater.removeAllListeners()
  mocks.updaterEvents.removeAllListeners()
  mocks.checkForUpdates.mockResolvedValue(null)
  updater = await import('./updater')
})

afterEach(() => {
  updater.stopUpdater()
  vi.restoreAllMocks()
  if (originalAppImage === undefined) {
    delete process.env.APPIMAGE
  } else {
    process.env.APPIMAGE = originalAppImage
  }
})

describe('updater install lifecycle', () => {
  it('throws when trying to install before an update is downloaded', () => {
    expect(() => updater.installDownloadedUpdate()).toThrow('No downloaded update is ready to install.')
    expect(mocks.quitAndInstall).not.toHaveBeenCalled()
  })

  it('disables auto-update on non-AppImage Linux builds', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    updater.initializeUpdater()
    expect(updater.getUpdateState().status).toBe('disabled')
  })

  it('enables auto-update on Linux AppImage builds', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux')
    process.env.APPIMAGE = '/tmp/GitLab-MR-Manager.AppImage'
    updater.initializeUpdater()
    expect(mocks.checkForUpdates).toHaveBeenCalledOnce()
  })

  it('runs pre-install shutdown callback before quitAndInstall and destroys open windows on before-quit-for-update', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
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
  })
})
