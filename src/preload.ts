import { contextBridge, ipcRenderer } from 'electron'
import type { Settings, AppState, UpdateState } from './shared/types'

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Settings): Promise<void> => ipcRenderer.invoke('save-settings', settings),
  getAppState: (): Promise<AppState> => ipcRenderer.invoke('get-app-state'),
  triggerSync: (): Promise<void> => ipcRenderer.invoke('trigger-sync'),
  openUrl: (url: string): Promise<void> => ipcRenderer.invoke('open-url', url),
  getUpdateState: (): Promise<UpdateState> => ipcRenderer.invoke('get-update-state'),
  checkForUpdates: (): Promise<UpdateState> => ipcRenderer.invoke('check-for-updates'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('install-update'),
  getWebhookUrl: (): Promise<string | null> => ipcRenderer.invoke('get-webhook-url'),
  checkCloudflared: (): Promise<{ available: boolean; path: string | null }> =>
    ipcRenderer.invoke('check-cloudflared'),
  getMergedMRsByAuthor: (username: string): Promise<import('./shared/types').MergeRequest[]> =>
    ipcRenderer.invoke('get-merged-mrs-by-author', username),
  onAppStateUpdated: (callback: (state: AppState) => void) => {
    ipcRenderer.on('app-state-updated', (_event, state: AppState) => callback(state))
    return () => ipcRenderer.removeAllListeners('app-state-updated')
  },
  onTunnelStatus: (callback: (status: { status: string; url?: string; message?: string; synced?: number; failed?: number }) => void) => {
    ipcRenderer.on('tunnel-status', (_event, data) => callback(data))
    return () => ipcRenderer.removeAllListeners('tunnel-status')
  },
  onUpdateStateChanged: (callback: (state: UpdateState) => void) => {
    ipcRenderer.on('update-state-changed', (_event, state: UpdateState) => callback(state))
    return () => ipcRenderer.removeAllListeners('update-state-changed')
  },
  onShowSettings: (callback: () => void) => {
    ipcRenderer.on('show-settings', () => callback())
    return () => ipcRenderer.removeAllListeners('show-settings')
  },
})
