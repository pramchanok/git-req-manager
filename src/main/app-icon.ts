import { app, nativeImage } from 'electron'
import fs from 'fs'
import path from 'path'

let cachedAppIcon: Electron.NativeImage | null | undefined

export const windowsAppUserModelId = process.env.NODE_ENV === 'development'
  ? 'com.gitlab-req-manager.desktop.dev'
  : 'com.gitlab-req-manager.desktop'

function getWindowsTaskbarIconPath(): string | undefined {
  // In dev mode this is a real filesystem path. Packaged assets live inside
  // app.asar, so electron-builder's executable icon remains the source of
  // truth for the packaged app.
  if (process.platform !== 'win32' || app.isPackaged) return undefined
  return path.join(app.getAppPath(), 'assets', 'icon.ico')
}

/**
 * Load the application icon from a buffer so it works in both dev mode and
 * packaged ASAR builds. Prefer PNG for runtime windows because it is parsed
 * consistently by Electron in development; keep ICO as a Windows fallback.
 */
export function getAppIcon(): Electron.NativeImage | undefined {
  if (cachedAppIcon !== undefined) return cachedAppIcon ?? undefined

  const assetsDir = path.join(app.getAppPath(), 'assets')
  const filenames = process.platform === 'win32'
    ? ['icon.png', 'icon.ico']
    : ['icon.png']

  for (const filename of filenames) {
    try {
      const icon = nativeImage.createFromBuffer(fs.readFileSync(path.join(assetsDir, filename)))
      if (!icon.isEmpty()) {
        cachedAppIcon = icon
        return icon
      }
    } catch (error) {
      console.warn(`[app] failed to load icon ${filename}:`, error)
    }
  }

  cachedAppIcon = null
  console.warn('[app] no usable application icon was found')
  return undefined
}

/** Apply the icon again after creation for Windows/Linux taskbar surfaces. */
export function applyAppIconToWindow(win: Electron.BrowserWindow): void {
  const icon = getAppIcon()
  if (icon && (process.platform === 'win32' || process.platform === 'linux')) {
    win.setIcon(icon)
  }

  if (process.platform === 'win32') {
    const appIconPath = getWindowsTaskbarIconPath()
    win.setAppDetails({
      appId: windowsAppUserModelId,
      ...(appIconPath ? { appIconPath } : {}),
    })
  }
}
