import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import {
  createTray,
  updateTrayBadge,
  destroyTray,
  setTrayWindow,
  setWindowFactory,
  showTrayWindow,
  hideWindow,
} from './tray'
import { getSettings, saveSettings, isConfigured } from './store'
import {
  startScheduler,
  stopScheduler,
  syncNow,
  getAppState,
  setStateChangeCallback,
} from './scheduler'
import { startWebhookServer, stopWebhookServer, getWebhookAddress } from './webhook'
import {
  startTunnel,
  stopTunnel,
  getTunnelUrl,
  findCloudflared,
  setTunnelWindow,
  setTunnelUrlCallback,
} from './tunnel'
import { connectSocketClient, disconnectSocketClient, extractServerUrl } from './socket-client'
import {
  initializeUpdater,
  getUpdateState,
  checkForUpdates,
  installDownloadedUpdate,
  setUpdaterWindowGetter,
} from './updater'
import {
  acquireSingleInstanceChannel,
  cleanupSingleInstanceChannel,
  setSecondInstanceHandler,
} from './single-instance'
import { GitLabClient } from '../shared/gitlab'
import type { AppState, Settings } from '../shared/types'

let mainWindow: BrowserWindow | null = null
let isQuitting = false
let revealWindowOnReady = false
const windowsAppUserModelId = 'com.gitlab-req-manager.app'

if (process.platform === 'win32') {
  app.setAppUserModelId(windowsAppUserModelId)
}

function exitDuplicateInstance(): never {
  app.exit(0)
  process.exit(0)
}

function revealMainWindow(): void {
  if (!app.isReady()) {
    revealWindowOnReady = true
    return
  }

  showTrayWindow(getOrCreateMainWindow())
}

async function startApp(): Promise<void> {
  setSecondInstanceHandler(() => {
    revealMainWindow()
  })

  const gotSingleInstanceChannel = await acquireSingleInstanceChannel()
  if (!gotSingleInstanceChannel) {
    exitDuplicateInstance()
  }

  app.whenReady().then(() => {
    // Sync login item status from OS to store on startup
    const loginSettings = app.getLoginItemSettings()
    const storedSettings = getSettings()
    if (storedSettings.launchAtStartup !== loginSettings.openAtLogin) {
      storedSettings.launchAtStartup = loginSettings.openAtLogin
      saveSettings(storedSettings)
    }

    mainWindow = registerMainWindow(createWindow())
    setTunnelUrlCallback((url) => autoSyncWebhooks(`${url}/webhook`))

    setStateChangeCallback((state: AppState) => {
      // Update tray badge
      const reviewCount = state.myReviewMRs.length
      updateTrayBadge(reviewCount)

      // Push state to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('app-state-updated', state)
      }
    })

    createTray(mainWindow)

    // Allow tray to recreate the window if it gets destroyed
    setWindowFactory(() => {
      return getOrCreateMainWindow()
    })

    setupIPC()
    initializeUpdater()

    if (revealWindowOnReady) {
      revealWindowOnReady = false
      revealMainWindow()
    }

    if (isConfigured()) {
      const settings = getSettings()
      if (settings.webhookEnabled) {
        syncNow()
        startWebhookServer(settings.webhookPort, settings.webhookSecret, () => { syncNow() })
        if (settings.webhookUseTunnel) {
          startTunnel(settings.webhookPort)
        } else if (settings.webhookPublicUrl.trim()) {
          const serverUrl = extractServerUrl(settings.webhookPublicUrl)
          if (serverUrl) connectSocketClient(serverUrl, () => syncNow())
        }
      } else {
        startScheduler(settings.refreshIntervalMinutes)
      }
    }
  })

  app.on('activate', () => {
    revealMainWindow()
  })

  app.on('window-all-closed', (e: Event) => {
    // Prevent quitting when all windows closed (tray app)
    e.preventDefault()
  })

  app.on('before-quit', () => {
    isQuitting = true
    stopScheduler()
    stopWebhookServer()
    stopTunnel()
    disconnectSocketClient()
    destroyTray()
    void cleanupSingleInstanceChannel()
  })

}

void startApp().catch((error) => {
  console.error('[app] startup failed:', error)
  app.exit(1)
})

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 380,
    height: 560,
    resizable: false,
    frame: false,
    show: false,
    skipTaskbar: process.platform !== 'darwin',
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  win.on('close', (e) => {
    if (isQuitting) return

    // Intercept close → hide to tray instead of quitting
    e.preventDefault()
    hideWindow(win)
  })

  return win
}

function registerMainWindow(win: BrowserWindow): BrowserWindow {
  mainWindow = win
  setTrayWindow(win)
  setTunnelWindow(win)
  setUpdaterWindowGetter(() => mainWindow)

  win.webContents.once('did-finish-load', () => {
    showTrayWindow(win)
  })

  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null
    }
  })

  return win
}

function getOrCreateMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow
  }

  return registerMainWindow(createWindow())
}

async function autoSyncWebhooks(webhookUrl: string): Promise<void> {
  const settings = getSettings()
  if (!settings.webhookEnabled || !settings.gitlabUrl || !settings.accessToken) return

  const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)

  try {
    const user = await client.getCurrentUser()
    const result = await client.syncWebhooksToAllProjects(
      webhookUrl,
      settings.webhookSecret,
      settings.projectIds,
      user.username
    )
    console.log(`[webhook] auto-synced for ${user.username}: ${result.success} ok, ${result.failed} failed`)

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tunnel-status', {
        status: 'connected',
        url: webhookUrl,
        synced: result.success,
        failed: result.failed,
      })
    }
  } catch (err) {
    console.error('[webhook] auto-sync failed:', err)
  }
}

function setupIPC(): void {
  ipcMain.handle('get-settings', () => getSettings())

  ipcMain.handle('save-settings', (_event, settings: Settings) => {
    saveSettings(settings)

    // Apply launch at startup
    app.setLoginItemSettings({
      openAtLogin: settings.launchAtStartup,
      openAsHidden: true,   // start minimized to tray, not visible
    })

    if (settings.webhookEnabled) {
      // Webhook active — ปิด polling, sync ครั้งเดียวตอนเริ่ม
      stopScheduler()
      syncNow()
      startWebhookServer(settings.webhookPort, settings.webhookSecret, () => { syncNow() })
      if (settings.webhookUseTunnel) {
        disconnectSocketClient()
        startTunnel(settings.webhookPort)
      } else {
        stopTunnel()
        if (settings.webhookPublicUrl.trim()) {
          autoSyncWebhooks(settings.webhookPublicUrl.trim())
          const serverUrl = extractServerUrl(settings.webhookPublicUrl)
          if (serverUrl) connectSocketClient(serverUrl, () => syncNow())
        }
      }
    } else {
      stopWebhookServer()
      stopTunnel()
      disconnectSocketClient()
      startScheduler(settings.refreshIntervalMinutes)
    }
  })

  ipcMain.handle('get-app-state', () => getAppState())
  ipcMain.handle('trigger-sync', () => syncNow())
  ipcMain.handle('open-url', (_event, url: string) => shell.openExternal(url))
  ipcMain.handle('get-update-state', () => getUpdateState())
  ipcMain.handle('check-for-updates', () => checkForUpdates())
  ipcMain.handle('install-update', () => installDownloadedUpdate())

  ipcMain.handle('get-webhook-url', () => {
    const settings = getSettings()
    if (!settings.webhookEnabled) return null
    // Tunnel URL takes priority if active
    const tunnelUrl = getTunnelUrl()
    if (settings.webhookUseTunnel && tunnelUrl) {
      return `${tunnelUrl}/webhook`
    }
    return getWebhookAddress(settings.webhookPort, settings.webhookPublicUrl)
  })

  ipcMain.handle('check-cloudflared', async () => {
    const bin = await findCloudflared()
    return { available: !!bin, path: bin }
  })
}

