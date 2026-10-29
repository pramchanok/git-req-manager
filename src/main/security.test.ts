import { EventEmitter } from 'node:events'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { IpcMainInvokeEvent, WebContents } from 'electron'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  openExternal: vi.fn(),
  getAppPath: vi.fn(() => path.resolve('/app')),
}))

vi.mock('electron', () => ({
  shell: { openExternal: mocks.openExternal },
  app: { getAppPath: mocks.getAppPath },
}))

import {
  assertTrustedIpcSender,
  hardenWebContents,
  isSafeExternalHttpUrl,
  isTrustedRendererUrl,
  openSafeExternalUrl,
} from './security'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('external URL validation', () => {
  test.each([
    'https://gitlab.example.com/group/project/-/merge_requests/1',
    'http://gitlab.internal:8080/mr/2',
  ])('allows safe http(s) URL: %s', async (url) => {
    expect(isSafeExternalHttpUrl(url)).toBe(true)
    await openSafeExternalUrl(url)
    expect(mocks.openExternal).toHaveBeenCalledExactlyOnceWith(url)
  })

  test.each([
    'javascript:alert(1)',
    'file:///C:/Windows/System32/calc.exe',
    'smb://attacker.example/share',
    'ms-msdt:/id PCWDiagnostic',
    'vscode://file/C:/repo/file.ts',
    '',
    'not a url',
  ])('blocks unsafe or malformed URL: %j', async (url) => {
    expect(isSafeExternalHttpUrl(url)).toBe(false)
    await openSafeExternalUrl(url)
    expect(mocks.openExternal).not.toHaveBeenCalled()
  })
})

describe('trusted renderer origin checks', () => {
  const rendererFile = path.resolve('/app/dist/renderer/index.html')
  const splashFile = path.resolve('/app/assets/splash.html')
  const allowedFilePaths = [rendererFile, splashFile]

  test('accepts packaged renderer file URLs including query params and hashes', () => {
    const url = `${pathToFileURL(rendererFile).toString()}?page=mr-detail&projectId=10&mrIid=4#changes`
    expect(isTrustedRendererUrl(url, { isDevelopment: false, allowedFilePaths })).toBe(true)
    expect(isTrustedRendererUrl(pathToFileURL(splashFile).toString(), { isDevelopment: false, allowedFilePaths })).toBe(true)
  })

  test('rejects arbitrary local files and remote websites in production', () => {
    const otherLocal = pathToFileURL(path.resolve('/app/README.md')).toString()
    expect(isTrustedRendererUrl(otherLocal, { isDevelopment: false, allowedFilePaths })).toBe(false)
    expect(isTrustedRendererUrl('https://evil.example/phish', { isDevelopment: false, allowedFilePaths })).toBe(false)
    expect(isTrustedRendererUrl('http://localhost:5173/?page=mr-detail', { isDevelopment: false, allowedFilePaths })).toBe(false)
  })

  test('allows Vite dev server origin only in development mode', () => {
    expect(isTrustedRendererUrl('http://localhost:5173/?page=report', { isDevelopment: true, allowedFilePaths })).toBe(true)
    expect(isTrustedRendererUrl('http://localhost:5174/', { isDevelopment: true, allowedFilePaths })).toBe(false)
    expect(isTrustedRendererUrl('https://evil.example', { isDevelopment: true, allowedFilePaths })).toBe(false)
  })

  test('blocks IPC calls from untrusted origins or non-main subframes', () => {
    const trustedUrl = pathToFileURL(rendererFile).toString()
    const mainFrame = { url: trustedUrl }
    const validEvent = {
      sender: { mainFrame, getURL: () => trustedUrl },
      senderFrame: mainFrame,
    } as unknown as IpcMainInvokeEvent

    expect(() => assertTrustedIpcSender(validEvent, 'get-settings', { isDevelopment: false, allowedFilePaths })).not.toThrow()

    const subframeEvent = {
      sender: { mainFrame, getURL: () => trustedUrl },
      senderFrame: { url: trustedUrl },
    } as unknown as IpcMainInvokeEvent
    expect(() => assertTrustedIpcSender(subframeEvent, 'get-settings', { isDevelopment: false, allowedFilePaths })).toThrow(/subframe/)

    const remoteFrame = { url: 'https://evil.example/' }
    const remoteEvent = {
      sender: { mainFrame: remoteFrame, getURL: () => remoteFrame.url },
      senderFrame: remoteFrame,
    } as unknown as IpcMainInvokeEvent
    expect(() => assertTrustedIpcSender(remoteEvent, 'get-settings', { isDevelopment: false, allowedFilePaths })).toThrow(/untrusted/)
  })
})

describe('webContents navigation and popup hardening', () => {
  const rendererFile = path.resolve('/app/dist/renderer/index.html')
  const allowedFilePaths = [rendererFile]

  function createMockWebContents() {
    let windowOpenHandler: ((details: { url: string }) => { action: 'allow' | 'deny' }) | null = null
    const emitter = new EventEmitter()
    const contents = Object.assign(emitter, {
      setWindowOpenHandler: vi.fn((fn: typeof windowOpenHandler) => {
        windowOpenHandler = fn
      }),
    })
    return {
      contents: contents as unknown as WebContents,
      openPopup: (url: string) => windowOpenHandler?.({ url }),
      emitter,
    }
  }

  test('denies window.open popups and redirects safe http(s) URLs to OS browser', () => {
    const { contents, openPopup } = createMockWebContents()
    hardenWebContents(contents, { isDevelopment: false, allowedFilePaths })

    expect(openPopup('https://gitlab.example.com/mr/1')).toEqual({ action: 'deny' })
    expect(mocks.openExternal).toHaveBeenCalledExactlyOnceWith('https://gitlab.example.com/mr/1')

    mocks.openExternal.mockClear()
    expect(openPopup('file:///etc/passwd')).toEqual({ action: 'deny' })
    expect(mocks.openExternal).not.toHaveBeenCalled()
  })

  test('prevents in-window navigation to external sites while allowing trusted app reloads', () => {
    const { contents, emitter } = createMockWebContents()
    hardenWebContents(contents, { isDevelopment: false, allowedFilePaths })

    const externalNavEvent = { preventDefault: vi.fn() }
    emitter.emit('will-navigate', externalNavEvent, 'https://evil.example/steal-token')
    expect(externalNavEvent.preventDefault).toHaveBeenCalledOnce()
    expect(mocks.openExternal).toHaveBeenCalledExactlyOnceWith('https://evil.example/steal-token')

    mocks.openExternal.mockClear()
    const unsafeSchemeEvent = { preventDefault: vi.fn() }
    emitter.emit('will-navigate', unsafeSchemeEvent, 'javascript:alert(1)')
    expect(unsafeSchemeEvent.preventDefault).toHaveBeenCalledOnce()
    expect(mocks.openExternal).not.toHaveBeenCalled()

    const trustedNavEvent = { preventDefault: vi.fn() }
    emitter.emit('will-navigate', trustedNavEvent, `${pathToFileURL(rendererFile).toString()}?page=mr-detail`)
    expect(trustedNavEvent.preventDefault).not.toHaveBeenCalled()
    expect(mocks.openExternal).not.toHaveBeenCalled()

    const webviewEvent = { preventDefault: vi.fn() }
    emitter.emit('will-attach-webview', webviewEvent)
    expect(webviewEvent.preventDefault).toHaveBeenCalledOnce()
  })
})
