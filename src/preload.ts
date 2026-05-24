import { contextBridge, ipcRenderer } from 'electron'
import type { Settings, AppState, UpdateState, GitLabGroup } from './shared/types'

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
  getGitLabGroups: (): Promise<GitLabGroup[]> =>
    ipcRenderer.invoke('get-gitlab-groups'),
  getGroupMembers: (groupId: number): Promise<import('./shared/types').GitLabUser[]> =>
    ipcRenderer.invoke('get-group-members', groupId),
  getTeamReportGroup: (): Promise<number | null> =>
    ipcRenderer.invoke('get-team-report-group'),
  setTeamReportGroup: (id: number | null): Promise<void> =>
    ipcRenderer.invoke('set-team-report-group', id),
  getChangelog: (): Promise<string | null> =>
    ipcRenderer.invoke('get-changelog'),
  setLastSeenVersion: (): Promise<void> =>
    ipcRenderer.invoke('set-last-seen-version'),
  getOwnerGroups: (): Promise<import('./shared/types').GitLabGroup[]> =>
    ipcRenderer.invoke('get-owner-groups'),
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
  onShowChangelog: (callback: () => void) => {
    ipcRenderer.on('show-changelog', () => callback())
    return () => ipcRenderer.removeAllListeners('show-changelog')
  },
})
