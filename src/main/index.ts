import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import {
  createTray,
  updateTrayBadge,
  updateTrayMRs,
  updateTrayUpdate,
  destroyTray,
  setTrayWindow,
  setWindowFactory,
  showTrayWindow,
  hideWindow,
} from './tray'
import { getSettings, saveSettings, isConfigured, getTeamReportGroupId, saveTeamReportGroupId, getLastSeenVersion, setLastSeenVersion } from './store'
import {
  startScheduler,
  stopScheduler,
  syncNow,
  getAppState,
  setStateChangeCallback,
  handleWebhookMerge,
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
  setUpdateStateCallback,
  stopUpdater,
} from './updater'
import {
  acquireSingleInstanceChannel,
  cleanupSingleInstanceChannelSync,
  setSecondInstanceHandler,
} from './single-instance'
import { GitLabClient } from '../shared/gitlab'
import type { AppState, Settings } from '../shared/types'
let mainWindow: BrowserWindow | null = null
let isQuitting = false
let revealWindowOnReady = false
let isInitialLaunch = true
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
    const storedSettings = getSettings()

    if (process.platform === 'win32') {
      // Migration from <=v1.2.1: registry entries were set without args, so
      // wasOpenedAtLogin was unreliable (true on every launch, not just startup).
      // Remove old-format entry (no args) and re-register with --openedAtLogin
      // so startup launches can be detected reliably via process.argv.
      app.setLoginItemSettings({ openAtLogin: false })
      if (storedSettings.launchAtStartup) {
        app.setLoginItemSettings({
          openAtLogin: true,
          openAsHidden: true,
          args: ['--openedAtLogin'],
        })
      }
    }

    // Sync login item status from OS to store on startup.
    // Pass the same args used in setLoginItemSettings so Windows can match the registry entry.
    const loginSettings = app.getLoginItemSettings(
      process.platform === 'win32' ? { args: ['--openedAtLogin'] } : {}
    )
    if (storedSettings.launchAtStartup !== loginSettings.openAtLogin) {
      storedSettings.launchAtStartup = loginSettings.openAtLogin
      saveSettings(storedSettings)
    }

    mainWindow = registerMainWindow(createWindow())
    setTunnelUrlCallback((url) => autoSyncWebhooks(`${url}/webhook`))

    setStateChangeCallback((state: AppState) => {
      // Update tray badge and MR list for quick-open menu
      updateTrayBadge(state.myReviewMRs.length)
      updateTrayMRs(state.myReviewMRs)

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
    setUpdateStateCallback((state) => {
      updateTrayUpdate(state.status, state.availableVersion ?? state.downloadedVersion)
    })
    initializeUpdater()

    // Show changelog automatically on first launch after an update
    const currentVersion = app.getVersion()
    const lastSeenVersion = getLastSeenVersion()
    if (lastSeenVersion && lastSeenVersion !== currentVersion) {
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow?.webContents.send('show-changelog')
      })
    }

    if (revealWindowOnReady) {
      revealWindowOnReady = false
      revealMainWindow()
    }

    if (isConfigured()) {
      const settings = getSettings()
      if (settings.webhookEnabled) {
        syncNow()
        startWebhookServer(settings.webhookPort, settings.webhookSecret, (payload) => {
          // Real-time merge notification for the MR author
          if (payload.action === 'merge' && payload.authorId && payload.projectId && payload.mrIid) {
            void handleWebhookMerge(payload.authorId, payload.projectId, payload.mrIid)
          }
          syncNow()
        })
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

  app.on('window-all-closed', () => {
    // When quitting intentionally (e.g. quitAndInstall), let the quit proceed.
    // Otherwise keep the app alive in the tray when all windows are closed.
    if (isQuitting) app.quit()
  })

  app.on('before-quit', () => {
    isQuitting = true
    stopScheduler()
    stopUpdater()
    stopWebhookServer()
    stopTunnel()
    disconnectSocketClient()
    destroyTray()
    cleanupSingleInstanceChannelSync()
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
    // Only apply startup-hidden logic on the very first window.
    // Recreated windows (after the original is destroyed) should always show.
    if (!isInitialLaunch) {
      showTrayWindow(win)
      return
    }
    isInitialLaunch = false

    const { wasOpenedAsHidden } = app.getLoginItemSettings()
    // On macOS: wasOpenedAsHidden = launched from login item with openAsHidden:true
    // On Windows: check --openedAtLogin arg (more reliable than wasOpenedAtLogin)
    const startHidden =
      wasOpenedAsHidden || (process.platform === 'win32' && process.argv.includes('--openedAtLogin'))

    if (startHidden) {
      // Stay in tray only — do not show window or Dock icon
      if (process.platform === 'darwin') app.dock?.hide()
    } else {
      showTrayWindow(win)
    }
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
      // Pass explicit arg on Windows so we can reliably detect startup launches
      // via process.argv instead of the unreliable wasOpenedAtLogin property.
      args: process.platform === 'win32' ? ['--openedAtLogin'] : [],
    })

    if (settings.webhookEnabled) {
      // Webhook active — ปิด polling, sync ครั้งเดียวตอนเริ่ม
      stopScheduler()
      syncNow()
      startWebhookServer(settings.webhookPort, settings.webhookSecret, (payload) => {
        // Real-time merge notification for the MR author
        if (payload.action === 'merge' && payload.authorId && payload.projectId && payload.mrIid) {
          void handleWebhookMerge(payload.authorId, payload.projectId, payload.mrIid)
        }
        syncNow()
      })
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
  ipcMain.handle('install-update', () => {
    isQuitting = true
    installDownloadedUpdate()
  })

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

  ipcMain.handle('get-merged-mrs-by-author', async (_event, username: string) => {
    if (!isConfigured()) return []
    const settings = getSettings()
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)
    return client.getMergedMRsByAuthor(username)
  })

  ipcMain.handle('get-gitlab-groups', async () => {
    if (!isConfigured()) return []
    const settings = getSettings()
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)
    return client.getGroups()
  })

  ipcMain.handle('get-group-members', async (_event, groupId: number) => {
    if (!isConfigured()) return []
    const settings = getSettings()
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)
    return client.getGroupMembers(groupId)
  })

  ipcMain.handle('get-team-report-group', () => getTeamReportGroupId())

  ipcMain.handle('set-team-report-group', (_event, id: number | null) => saveTeamReportGroupId(id))

  ipcMain.handle('get-changelog', () => {
    try {
      const changelogPath = path.join(app.getAppPath(), 'CHANGELOG.md')
      return fs.readFileSync(changelogPath, 'utf-8')
    } catch {
      return null
    }
  })

  ipcMain.handle('set-last-seen-version', () => {
    setLastSeenVersion(app.getVersion())
  })

  ipcMain.handle('get-owner-groups', async () => {
    if (!isConfigured()) return []
    const settings = getSettings()
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)
    return client.getOwnerGroups().catch(() => [])
  })

  ipcMain.handle('get-group-mrs-in-timeframe', async (_event, groupId: number, since: string, until?: string) => {
    if (!isConfigured()) return []
    const settings = getSettings()
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)
    return client.getGroupMRsInTimeframe(groupId, since, until).catch(() => [])
  })

  ipcMain.handle('open-report-window', (_event, username: string, name: string, avatarUrl: string, timeframe: string, groupId: number) => {
    const reportWin = new BrowserWindow({
      width: 1000,
      height: 700,
      resizable: true,
      frame: true,
      title: `Developer Report: ${name}`,
      icon: path.join(app.getAppPath(), 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
      webPreferences: {
        preload: path.join(__dirname, '../preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    reportWin.setMenuBarVisibility(false)

    if (process.env.NODE_ENV === 'development') {
      reportWin.loadURL(`http://localhost:5173/?page=report&username=${encodeURIComponent(username)}&name=${encodeURIComponent(name)}&avatarUrl=${encodeURIComponent(avatarUrl)}&timeframe=${encodeURIComponent(timeframe)}&groupId=${groupId}`)
    } else {
      reportWin.loadFile(path.join(__dirname, '../renderer/index.html'), {
        query: {
          page: 'report',
          username,
          name,
          avatarUrl,
          timeframe,
          groupId: String(groupId),
        }
      })
    }
  })

  ipcMain.handle('open-mr-window', (_event, projectId: number, mrIid: number) => {
    const mrWin = new BrowserWindow({
      width: 900,
      height: 700,
      resizable: true,
      frame: true,
      title: `MR !${mrIid}`,
      icon: path.join(app.getAppPath(), 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
      webPreferences: {
        preload: path.join(__dirname, '../preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    mrWin.setMenuBarVisibility(false)

    if (process.env.NODE_ENV === 'development') {
      mrWin.loadURL(`http://localhost:5173/?page=mr-detail&projectId=${projectId}&mrIid=${mrIid}`)
    } else {
      mrWin.loadFile(path.join(__dirname, '../renderer/index.html'), {
        query: {
          page: 'mr-detail',
          projectId: String(projectId),
          mrIid: String(mrIid),
        }
      })
    }
  })

  ipcMain.handle('get-mr-by-iid', async (_event, projectId: number, mrIid: number) => {
    if (!isConfigured()) throw new Error('Not configured')
    const settings = getSettings()
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)
    return client.getMRByIid(projectId, mrIid)
  })

  ipcMain.handle('export-report-pdf', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false

    const { filePath } = await dialog.showSaveDialog(win, {
      title: 'Save PDF Report',
      defaultPath: `Developer_Report.pdf`,
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    })

    if (!filePath) return false

    try {
      const pdfBuffer = await win.webContents.printToPDF({
        printBackground: true,
        margins: { top: 30, bottom: 30, left: 30, right: 30 },
        pageSize: 'A4',
      })
      fs.writeFileSync(filePath, pdfBuffer)
      return true
    } catch (err) {
      console.error('[export-pdf] failed:', err)
      return false
    }
  })

  ipcMain.handle('save-report-file', async (event, filename: string, content: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false

    const ext = filename.split('.').pop() || 'txt'
    const filters = ext === 'csv'
      ? [{ name: 'CSV (Excel) Files', extensions: ['csv'] }]
      : [{ name: 'Markdown Files', extensions: ['md'] }]

    const { filePath } = await dialog.showSaveDialog(win, {
      title: `Save ${ext.toUpperCase()} Report`,
      defaultPath: filename,
      filters: filters,
    })

    if (!filePath) return false

    try {
      fs.writeFileSync(filePath, content, 'utf-8')
      return true
    } catch (err) {
      console.error('[save-report-file] failed:', err)
      return false
    }
  })

  // ────── In-App Review & MR Actions ──────

  ipcMain.handle('get-mr-diffs', async (_event, projectId: number, mrIid: number) => {
    if (!isConfigured()) return []
    const settings = getSettings()
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)
    return client.getMRDiffs(projectId, mrIid)
  })

  ipcMain.handle('get-mr-discussions', async (_event, projectId: number, mrIid: number) => {
    if (!isConfigured()) return []
    const settings = getSettings()
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)
    return client.getMRDiscussions(projectId, mrIid)
  })

  ipcMain.handle('add-mr-note', async (_event, projectId: number, mrIid: number, body: string) => {
    if (!isConfigured()) return
    const settings = getSettings()
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)
    await client.addMRNote(projectId, mrIid, body)
  })

  ipcMain.handle('approve-mr', async (_event, projectId: number, mrIid: number) => {
    if (!isConfigured()) return
    const settings = getSettings()
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)
    await client.approveMR(projectId, mrIid)
  })

  ipcMain.handle('unapprove-mr', async (_event, projectId: number, mrIid: number) => {
    if (!isConfigured()) return
    const settings = getSettings()
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)
    await client.unapproveMR(projectId, mrIid)
  })

  ipcMain.handle('merge-mr', async (_event, projectId: number, mrIid: number) => {
    if (!isConfigured()) return
    const settings = getSettings()
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)
    await client.mergeMR(projectId, mrIid)
  })

  ipcMain.handle('close-mr', async (_event, projectId: number, mrIid: number) => {
    if (!isConfigured()) return
    const settings = getSettings()
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)
    await client.closeMR(projectId, mrIid)
  })

  ipcMain.handle('cancel-pipeline', async (_event, projectId: number, pipelineId: number) => {
    if (!isConfigured()) return
    const settings = getSettings()
    const client = new GitLabClient(settings.gitlabUrl, settings.accessToken)
    await client.cancelPipeline(projectId, pipelineId)
  })
}
