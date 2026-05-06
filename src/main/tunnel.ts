import { spawn, ChildProcess } from 'child_process'
import { BrowserWindow } from 'electron'
import which from 'which'

let tunnelProcess: ChildProcess | null = null
let tunnelUrl: string | null = null
let mainWindow: BrowserWindow | null = null
let onUrlReady: ((url: string) => void) | null = null

export function setTunnelWindow(win: BrowserWindow) {
  mainWindow = win
}

export function setTunnelUrlCallback(cb: (url: string) => void) {
  onUrlReady = cb
}

function notifyRenderer(event: string, data: unknown) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(event, data)
  }
}

export async function findCloudflared(): Promise<string | null> {
  try {
    return await which('cloudflared')
  } catch {
    return null
  }
}

export function getTunnelUrl(): string | null {
  return tunnelUrl
}

export function startTunnel(port: number): void {
  stopTunnel()
  tunnelUrl = null

  findCloudflared().then((bin) => {
    if (!bin) {
      notifyRenderer('tunnel-status', { status: 'not-found' })
      return
    }

    notifyRenderer('tunnel-status', { status: 'starting' })

    tunnelProcess = spawn(bin, ['tunnel', '--url', `http://localhost:${port}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const handleOutput = (data: Buffer) => {
      const text = data.toString()
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)
      if (match && !tunnelUrl) {
        tunnelUrl = match[0]
        notifyRenderer('tunnel-status', { status: 'connected', url: tunnelUrl })
        // Notify main process so it can auto-update GitLab webhooks
        onUrlReady?.(tunnelUrl)
      }
    }

    tunnelProcess.stdout?.on('data', handleOutput)
    tunnelProcess.stderr?.on('data', handleOutput)

    tunnelProcess.on('error', (err) => {
      notifyRenderer('tunnel-status', { status: 'error', message: err.message })
    })

    tunnelProcess.on('exit', (code) => {
      tunnelUrl = null
      tunnelProcess = null
      if (code !== 0 && code !== null) {
        notifyRenderer('tunnel-status', { status: 'stopped' })
      }
    })
  })
}

export function stopTunnel(): void {
  if (tunnelProcess) {
    tunnelProcess.kill()
    tunnelProcess = null
    tunnelUrl = null
  }
}
