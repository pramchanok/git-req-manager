import { app } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Electron's app.setLoginItemSettings() / getLoginItemSettings() are no-ops on
// Linux, so we manage a freedesktop autostart .desktop file ourselves.
// Spec: https://specifications.freedesktop.org/autostart-spec/

// electron-builder names the installed Linux desktop entry after build.appId.
// Read it from the packaged package.json so the autostart filename always
// matches, instead of hardcoding a value that can drift from the build config.
function appId(): string {
  try {
    const pkg = require(path.join(app.getAppPath(), 'package.json'))
    return pkg?.build?.appId || app.getName()
  } catch {
    return app.getName()
  }
}

function autostartDir(): string {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
  return path.join(configHome, 'autostart')
}

function autostartFile(): string {
  return path.join(autostartDir(), `${appId()}.desktop`)
}

// The command that should run at login. For a packaged AppImage the real path
// lives in the APPIMAGE env var (process.execPath points at the extracted
// runtime inside the mount). Fall back to execPath for other packaging/dev.
function launchExec(): string {
  return process.env.APPIMAGE || process.execPath
}

export function isLinuxAutostartEnabled(): boolean {
  try {
    return fs.existsSync(autostartFile())
  } catch {
    return false
  }
}

export function setLinuxAutostart(enabled: boolean): void {
  const file = autostartFile()
  try {
    if (enabled) {
      const exec = launchExec()
      const contents = [
        '[Desktop Entry]',
        'Type=Application',
        `Name=${app.getName()}`,
        // --openedAtLogin lets the app detect a startup launch and start hidden.
        `Exec="${exec}" --openedAtLogin`,
        'X-GNOME-Autostart-enabled=true',
        'Terminal=false',
        '',
      ].join('\n')
      fs.mkdirSync(autostartDir(), { recursive: true })
      fs.writeFileSync(file, contents, { mode: 0o644 })
    } else if (fs.existsSync(file)) {
      fs.unlinkSync(file)
    }
  } catch (error) {
    console.error('[linux-autostart] failed to update autostart entry:', error)
  }
}
