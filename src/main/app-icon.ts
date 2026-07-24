import { app, nativeImage } from 'electron'
import fs from 'fs'
import path from 'path'

let cachedAppIcon: Electron.NativeImage | null | undefined

export const windowsAppUserModelId = process.env.NODE_ENV === 'development'
  ? 'com.gitlab-req-manager.desktop.dev.v2'
  : 'com.gitlab-req-manager.desktop.v2'

function getWindowsTaskbarIconPath(): string | undefined {
  if (process.platform !== 'win32') return undefined

  // Windows taskbar metadata cannot reliably resolve an icon from inside
  // app.asar. In a packaged build the icon is embedded in the executable;
  // in dev mode use the real ICO file from the workspace.
  return app.isPackaged
    ? process.execPath
    : path.join(app.getAppPath(), 'assets', 'icon.ico')
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
