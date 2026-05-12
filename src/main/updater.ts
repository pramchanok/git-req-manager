import { app, BrowserWindow, Notification } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateDownloadedEvent, UpdateInfo, ProgressInfo } from 'electron-updater'
import type { UpdateState } from '../shared/types'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

let updaterInitialized = false
let mainWindowGetter: (() => BrowserWindow | null) | null = null
let updateCheckIntervalHandle: ReturnType<typeof setInterval> | null = null

let updateState: UpdateState = {
  currentVersion: app.getVersion(),
  status: 'idle',
  availableVersion: null,
  downloadedVersion: null,
  progressPercent: null,
  message: null,
  releaseDate: null,
}

function getMainWindow(): BrowserWindow | null {
  if (!mainWindowGetter) return null
  const win = mainWindowGetter()
  return win && !win.isDestroyed() ? win : null
}

function emitUpdateState(): void {
  getMainWindow()?.webContents.send('update-state-changed', updateState)
}

function setUpdateState(patch: Partial<UpdateState>): void {
  updateState = { ...updateState, ...patch }
  emitUpdateState()
}

function canUseAutoUpdates(): boolean {
  if (!app.isPackaged) return false
  return process.platform === 'win32' || process.platform === 'darwin'
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Unknown update error'
}

function setNotAvailableState(info?: UpdateInfo): void {
  setUpdateState({
    status: 'not-available',
    availableVersion: null,
    downloadedVersion: null,
    progressPercent: null,
    releaseDate: info?.releaseDate ?? null,
    message: 'You already have the latest version.',
  })
}

function setDownloadedState(info: UpdateDownloadedEvent): void {
  setUpdateState({
    status: 'downloaded',
    availableVersion: info.version,
    downloadedVersion: info.version,
    progressPercent: 100,
    releaseDate: info.releaseDate ?? null,
    message: `Version ${info.version} is ready to install.`,
  })
}

export function setUpdaterWindowGetter(getter: () => BrowserWindow | null): void {
  mainWindowGetter = getter
  emitUpdateState()
}

export function getUpdateState(): UpdateState {
  return { ...updateState }
}

export async function checkForUpdates(): Promise<UpdateState> {
  if (!canUseAutoUpdates()) {
    setUpdateState({
      status: 'disabled',
      message: app.isPackaged
        ? 'Auto update is only available on packaged Windows and macOS builds.'
        : 'Auto update works only in packaged builds.',
      progressPercent: null,
    })
    return getUpdateState()
  }

  if (updateState.status === 'checking' || updateState.status === 'downloading') {
    return getUpdateState()
  }

  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    setUpdateState({
      status: 'error',
      progressPercent: null,
      message: normalizeErrorMessage(error),
    })
  }

  return getUpdateState()
}

export function installDownloadedUpdate(): void {
  if (updateState.status !== 'downloaded') {
    throw new Error('No downloaded update is ready to install.')
  }

  autoUpdater.quitAndInstall()
}

export function initializeUpdater(): void {
  if (updaterInitialized) {
    emitUpdateState()
    return
  }

  updaterInitialized = true
  updateState = {
    ...updateState,
    currentVersion: app.getVersion(),
    message: null,
  }

  if (!canUseAutoUpdates()) {
    setUpdateState({
      status: 'disabled',
      message: app.isPackaged
        ? 'Auto update is only available on packaged Windows and macOS builds.'
        : 'Auto update works only in packaged builds.',
    })
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    setUpdateState({
      status: 'checking',
      availableVersion: null,
      downloadedVersion: null,
      progressPercent: null,
      message: 'Checking for updates…',
      releaseDate: null,
    })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    setUpdateState({
      status: 'available',
      availableVersion: info.version,
      downloadedVersion: null,
      progressPercent: 0,
      releaseDate: info.releaseDate ?? null,
      message: `Update ${info.version} found. Downloading…`,
    })
  })

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    setUpdateState({
      status: 'downloading',
      progressPercent: Math.round(progress.percent),
      message: `Downloading update… ${Math.round(progress.percent)}%`,
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
    setDownloadedState(info)

    if (Notification.isSupported()) {
      const notification = new Notification({
        title: 'GitLab MR Manager — Update ready',
        body: `Version ${info.version} has been downloaded. Click to install.`,
      })
      notification.on('click', () => {
        const win = getMainWindow()
        if (win) {
          win.show()
          win.focus()
        }
      })
      notification.show()
    }
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    setNotAvailableState(info)
  })

  autoUpdater.on('error', (error: Error) => {
    // "Not found" errors occur when a Windows release is published but the macOS
    // artifacts (latest-mac.yml) haven't been uploaded yet. Treat these as
    // "no update available" to avoid showing confusing error UI to users.
    const message = normalizeErrorMessage(error)
    const isNotFound = /404|not found|cannot find.*yml|enoent|enotfound/i.test(message)
    if (isNotFound) {
      setNotAvailableState()
      return
    }
    setUpdateState({
      status: 'error',
      progressPercent: null,
      message,
    })
  })

  void checkForUpdates()

  updateCheckIntervalHandle = setInterval(() => {
    void checkForUpdates()
  }, UPDATE_CHECK_INTERVAL_MS)
}

export function stopUpdater(): void {
  if (updateCheckIntervalHandle !== null) {
    clearInterval(updateCheckIntervalHandle)
    updateCheckIntervalHandle = null
  }
}
