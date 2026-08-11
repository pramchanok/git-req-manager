import { Tray, Menu, nativeImage, BrowserWindow, app, screen, shell, nativeTheme } from 'electron'
import fs from 'fs'
import path from 'path'
import type { MergeRequest, UpdateStatus } from '../shared/types'
import { checkForUpdates, installDownloadedUpdate } from './updater'

let tray: Tray | null = null
let trayMenu: Menu | null = null
let pendingCount = 0
let mrList: MergeRequest[] = []
let windowRef: BrowserWindow | null = null
let windowFactory: (() => BrowserWindow) | null = null
let updateStatus: UpdateStatus = 'idle'
let updateVersion: string | null = null

// Keep this GUID stable across releases so macOS can restore the user's
// menu-bar tray icon position after relaunches and auto-updates.
const TRAY_GUID = '5d4bd7b4-2d92-4b3b-9a25-1dd447cdbf1f'

function getOrCreateWindow(): BrowserWindow | null {
  if (windowRef && !windowRef.isDestroyed()) return windowRef
  if (windowFactory) {
    windowRef = windowFactory()
    updateTrayMenu()
    return windowRef
  }
  return null
}

function createIcon(state: 'default' | 'active' | 'update'): Electron.NativeImage {
  const baseName =
    state === 'update' ? 'tray-icon-update' :
    state === 'active' ? 'tray-icon-active' :
    'tray-icon'
  const assetsDir = path.join(app.getAppPath(), 'assets')

  // Use fs.readFileSync so we can read from inside an asar archive, then
  // build the image from a buffer.  nativeImage.createFromPath uses native
  // OS APIs that don't understand the asar virtual filesystem on macOS.
  const icon = nativeImage.createEmpty()
  const tryAdd = (filename: string, scale: number) => {
    try {
      const buf = fs.readFileSync(path.join(assetsDir, filename))
      icon.addRepresentation({ scaleFactor: scale, buffer: buf })
    } catch {
      // missing variant — skip silently
    }
  }
  tryAdd(`${baseName}.png`, 1.0)
  tryAdd(`${baseName}@2x.png`, 2.0)

  // Inactive icon: use template so macOS auto-adapts to light/dark mode
  // Active/update icons: keep colored so they stand out visually
  if (process.platform === 'darwin' && state === 'default') {
    icon.setTemplateImage(true)
  }
  return icon
}

export function createTray(mainWindow: BrowserWindow): Tray {
  windowRef = mainWindow
  tray = new Tray(createIcon('default'), TRAY_GUID)
  tray.setToolTip('GitLab MR Manager')
  updateTrayMenu()

  nativeTheme.on('updated', () => {
    refreshTrayIcon()
  })

  tray.on('click', () => {
    const win = getOrCreateWindow()
    if (!win) return
    if (win.isVisible() && win.isFocused()) {
      hideWindow(win)
    } else {
      showWindow(win)
    }
  })

  if (process.platform === 'darwin') {
    // On macOS, setContextMenu also opens the menu on a normal click. Keep
    // left-click for toggling the window and show the menu only on right-click.
    tray.on('right-click', () => {
      if (tray && trayMenu) tray.popUpContextMenu(trayMenu)
    })
  }

  return tray
}

export function setTrayWindow(win: BrowserWindow): void {
  windowRef = win
  updateTrayMenu()
}

export function setWindowFactory(factory: () => BrowserWindow): void {
  windowFactory = factory
}

export function updateTrayUpdate(status: UpdateStatus, version: string | null): void {
  updateStatus = status
  updateVersion = version
  refreshTrayIcon()
  updateTrayMenu()
}

export function updateTrayBadge(count: number): void {
  if (!tray) return
  pendingCount = count
  refreshTrayIcon()
  tray.setToolTip(
    count > 0 ? `GitLab MR Manager — ${count} MR(s) need review` : 'GitLab MR Manager'
  )
  updateTrayMenu()
}

function refreshTrayIcon(): void {
  if (!tray) return
  // Priority: update (blue) > pending MRs (orange) > default (grey)
  const hasUpdate = updateStatus === 'available' || updateStatus === 'downloading' || updateStatus === 'downloaded'
  const state = hasUpdate ? 'update' : pendingCount > 0 ? 'active' : 'default'
  tray.setImage(createIcon(state))
}

export function updateTrayMRs(mrs: MergeRequest[]): void {
  mrList = mrs
  updateTrayMenu()
}

function updateTrayMenu(): void {
  if (!tray) return

  const mrItems = mrList.slice(0, 3).map((mr) => ({
    label: mr.title.length > 45 ? mr.title.slice(0, 45) + '…' : mr.title,
    click: () => shell.openExternal(mr.webUrl),
  }))

  const updateItems: Electron.MenuItemConstructorOptions[] = []
  if (updateStatus === 'downloaded' && updateVersion) {
    updateItems.push(
      { type: 'separator' },
      {
        label: `⬆️ Update ready: v${updateVersion} — Click to install`,
        click: () => {
          installDownloadedUpdate()
        },
      }
    )
  } else if ((updateStatus === 'available' || updateStatus === 'downloading') && updateVersion) {
    updateItems.push(
      { type: 'separator' },
      {
        label: updateStatus === 'downloading'
          ? `⬇️ Downloading update v${updateVersion}…`
          : `🔔 Update available: v${updateVersion}`,
        enabled: false,
      }
    )
  } else if (updateStatus !== 'disabled') {
    updateItems.push(
      { type: 'separator' },
      {
        label: updateStatus === 'checking' ? '🔄 Checking for updates…' : '🔄 Check for Updates',
        enabled: updateStatus !== 'checking',
        click: () => {
          void checkForUpdates()
        },
      }
    )
  }

  trayMenu = Menu.buildFromTemplate([
    {
      label: pendingCount > 0 ? `📋 ${pendingCount} MR(s) need review` : '📋 No pending MRs',
      enabled: false,
    },
    ...(mrItems.length > 0
      ? [
          { type: 'separator' as const },
          { label: 'My Reviews', enabled: false },
          ...mrItems,
        ]
      : []),
    ...updateItems,
    { type: 'separator' },
    {
      label: 'Open',
      click: () => {
        const win = getOrCreateWindow()
        if (win) showWindow(win)
      },
    },
    {
      label: 'Settings',
      click: () => {
        const win = getOrCreateWindow()
        if (win) {
          showWindow(win)
          win.webContents.send('show-settings')
        }
      },
    },
    {
      label: 'Refresh',
      click: () => {
        const win = getOrCreateWindow()
        if (win) win.webContents.send('trigger-sync')
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ])

  if (process.platform !== 'darwin') {
    tray.setContextMenu(trayMenu)
  }
}

function showWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()

  // Position window near tray icon
  if (tray) {
    const trayBounds = tray.getBounds()
    const [winW, winH] = win.getSize()
    const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
    const { workArea } = display

    let x = Math.round(trayBounds.x + trayBounds.width / 2 - winW / 2)
    let y: number
    if (process.platform === 'darwin') {
      // Below the macOS menu bar
      y = Math.round(trayBounds.y + trayBounds.height + 4)
    } else {
      // Above the Windows taskbar
      y = Math.round(trayBounds.y - winH - 4)
    }

    // Clamp to work area
    x = Math.max(workArea.x, Math.min(x, workArea.x + workArea.width - winW))
    y = Math.max(workArea.y, Math.min(y, workArea.y + workArea.height - winH))
    win.setPosition(x, y)
  } else {
    // Fallback: center on primary display
    const { workAreaSize } = screen.getPrimaryDisplay()
    const [w, h] = win.getSize()
    win.setPosition(
      Math.round((workAreaSize.width - w) / 2),
      Math.round((workAreaSize.height - h) / 2)
    )
  }

  if (process.platform === 'darwin') {
    // app.dock.show() is async — await it so the app is fully out of agent mode
    // before calling app.focus(), otherwise the window may not receive focus.
    if (app.dock) {
      void app.dock.show().then(() => {
        app.focus({ steal: true })
        win.show()
        win.focus()
      })
    } else {
      app.focus({ steal: true })
      win.show()
      win.focus()
    }
  } else {
    // setAlwaysOnTop is needed on Windows to bypass focus-stealing prevention
    const wasAlwaysOnTop = win.isAlwaysOnTop()
    win.setAlwaysOnTop(true)
    win.show()
    win.focus()
    if (!wasAlwaysOnTop) {
      win.setAlwaysOnTop(false)
    }
  }
}

export function showTrayWindow(win: BrowserWindow): void {
  showWindow(win)
}

export function hideWindow(win: BrowserWindow): void {
  win.hide()

  if (process.platform === 'darwin') {
    app.dock?.hide()
  }
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
  trayMenu = null
  windowRef = null
}
