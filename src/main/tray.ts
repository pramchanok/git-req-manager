import { Tray, Menu, nativeImage, BrowserWindow, app, screen } from 'electron'
import path from 'path'

let tray: Tray | null = null
let pendingCount = 0
let windowRef: BrowserWindow | null = null
let windowFactory: (() => BrowserWindow) | null = null

function getOrCreateWindow(): BrowserWindow | null {
  if (windowRef && !windowRef.isDestroyed()) return windowRef
  if (windowFactory) {
    windowRef = windowFactory()
    updateTrayMenu()
    return windowRef
  }
  return null
}

function createIcon(active: boolean): Electron.NativeImage {
  const iconName = active ? 'tray-icon-active.png' : 'tray-icon.png'
  const iconPath = path.join(app.getAppPath(), 'assets', iconName)
  const icon = nativeImage.createFromPath(iconPath)
  // macOS requires template images for proper dark/light mode rendering in the menu bar
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true)
  }
  return icon
}

export function createTray(mainWindow: BrowserWindow): Tray {
  windowRef = mainWindow
  tray = new Tray(createIcon(false))
  tray.setToolTip('GitLab MR Manager')
  updateTrayMenu()

  tray.on('click', () => {
    const win = getOrCreateWindow()
    if (!win) return
    if (win.isVisible() && win.isFocused()) {
      hideWindow(win)
    } else {
      showWindow(win)
    }
  })

  return tray
}

export function setTrayWindow(win: BrowserWindow): void {
  windowRef = win
  updateTrayMenu()
}

export function setWindowFactory(factory: () => BrowserWindow): void {
  windowFactory = factory
}

export function updateTrayBadge(count: number): void {
  if (!tray) return
  pendingCount = count
  tray.setImage(createIcon(count > 0))
  tray.setToolTip(
    count > 0 ? `GitLab MR Manager — ${count} MR(s) need review` : 'GitLab MR Manager'
  )
  updateTrayMenu()
}

function updateTrayMenu(): void {
  if (!tray) return

  const contextMenu = Menu.buildFromTemplate([
    {
      label: pendingCount > 0 ? `📋 ${pendingCount} MR(s) need review` : '📋 No pending MRs',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Open',
      click: () => {
        const win = getOrCreateWindow()
        if (win) showWindow(win)
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

  tray.setContextMenu(contextMenu)
}

function showWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()

  // Center window on primary display
  const { workAreaSize } = screen.getPrimaryDisplay()
  const [w, h] = win.getSize()
  win.setPosition(
    Math.round((workAreaSize.width - w) / 2),
    Math.round((workAreaSize.height - h) / 2)
  )

  if (process.platform === 'darwin') {
    app.dock.show()
    // On macOS, app.dock.hide() puts the app in agent mode — must call app.focus()
    // to make the app active before showing the window, otherwise it won't receive focus
    app.focus({ steal: true })
    win.show()
    win.focus()
  } else {
    // setAlwaysOnTop is needed on Windows to bypass focus-stealing prevention
    win.setAlwaysOnTop(true)
    win.show()
    win.focus()
    win.setAlwaysOnTop(false)
  }
}

export function showTrayWindow(win: BrowserWindow): void {
  showWindow(win)
}

export function hideWindow(win: BrowserWindow): void {
  win.hide()

  if (process.platform === 'darwin') {
    app.dock.hide()
  }
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
  windowRef = null
}
