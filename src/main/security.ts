import { app, shell } from 'electron'
import type { IpcMainInvokeEvent, WebContents } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const DEV_RENDERER_ORIGIN = 'http://localhost:5173'

export interface TrustedRendererOptions {
  isDevelopment?: boolean
  allowedFilePaths?: string[]
  platform?: NodeJS.Platform
}

function normalizeFilePath(filePath: string, platform: NodeJS.Platform): string {
  const resolved = path.resolve(filePath)
  return platform === 'win32' ? resolved.toLowerCase() : resolved
}

function getDefaultAllowedFilePaths(): string[] {
  const paths = [path.resolve(__dirname, '../renderer/index.html')]
  try {
    if (typeof app?.getAppPath === 'function') {
      paths.push(path.resolve(app.getAppPath(), 'assets', 'splash.html'))
    }
  } catch {
    // Fallback relative to dist/main when app is not yet initialized in tests
    paths.push(path.resolve(__dirname, '../../assets/splash.html'))
  }
  return paths
}

/** อนุญาตเฉพาะ http:// และ https:// สำหรับเปิดออกไปยัง browser ภายนอก */
export function isSafeExternalHttpUrl(rawUrl: string): boolean {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false
  try {
    const parsed = new URL(rawUrl)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** เปิด URL ภายนอกผ่าน OS browser เฉพาะเมื่อเป็น http(s) เท่านั้น */
export async function openSafeExternalUrl(rawUrl: string): Promise<void> {
  if (!isSafeExternalHttpUrl(rawUrl)) {
    console.warn('[security] blocked non-http(s) external URL:', rawUrl)
    return
  }
  await shell.openExternal(rawUrl)
}

/** ตรวจสอบว่า URL เป็นหน้า renderer ของแอปเองจริง (กันหน้าเว็บภายนอกที่หลุดเข้ามาเรียก IPC) */
export function isTrustedRendererUrl(rawUrl: string, options: TrustedRendererOptions = {}): boolean {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false

  const isDevelopment = options.isDevelopment ?? process.env.NODE_ENV === 'development'
  const platform = options.platform ?? process.platform

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }

  if (isDevelopment && parsed.origin === DEV_RENDERER_ORIGIN) {
    return true
  }

  if (parsed.protocol !== 'file:') {
    return false
  }

  try {
    const targetPath = normalizeFilePath(fileURLToPath(parsed), platform)
    const allowedPaths = (options.allowedFilePaths ?? getDefaultAllowedFilePaths())
      .map((candidate) => normalizeFilePath(candidate, platform))
    return allowedPaths.includes(targetPath)
  } catch {
    return false
  }
}

/** ยืนยันว่า IPC invoke มาจาก top-level frame ของหน้า renderer ที่เชื่อถือได้เท่านั้น */
export function assertTrustedIpcSender(
  event: Pick<IpcMainInvokeEvent, 'sender' | 'senderFrame'>,
  channel: string,
  options: TrustedRendererOptions = {}
): void {
  const mainFrame = event.sender?.mainFrame
  if (event.senderFrame && mainFrame && event.senderFrame !== mainFrame) {
    throw new Error(`[security] blocked subframe IPC call to ${channel}`)
  }

  const senderUrl = event.senderFrame?.url || event.sender?.getURL?.() || ''
  if (!isTrustedRendererUrl(senderUrl, options)) {
    throw new Error(`[security] blocked untrusted IPC call to ${channel}`)
  }
}

/** บล็อกการเปิด popup และการ navigate ออกจากหน้าแอปในทุก BrowserWindow */
export function hardenWebContents(contents: WebContents, options: TrustedRendererOptions = {}): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalHttpUrl(url)) {
      void openSafeExternalUrl(url)
    }
    return { action: 'deny' }
  })

  contents.on('will-navigate', (event, navigationUrl) => {
    if (!isTrustedRendererUrl(navigationUrl, options)) {
      event.preventDefault()
      if (isSafeExternalHttpUrl(navigationUrl)) {
        void openSafeExternalUrl(navigationUrl)
      }
    }
  })

  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
}
