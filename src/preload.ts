import { contextBridge, ipcRenderer } from 'electron'
import type { Settings, AppState, UpdateState, GitLabGroup } from './shared/types'

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Settings): Promise<void> => ipcRenderer.invoke('save-settings', settings),
  getAppState: (): Promise<AppState> => ipcRenderer.invoke('get-app-state'),
  testNotification: (): Promise<void> => ipcRenderer.invoke('test-notification'),
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
  searchProjects: (query: string): Promise<import('./shared/types').GitLabProject[]> =>
    ipcRenderer.invoke('search-projects', query),
  getGroupMembers: (groupId: number): Promise<import('./shared/types').GitLabUser[]> =>
    ipcRenderer.invoke('get-group-members', groupId),
  getTeamReportGroup: (): Promise<number | null> =>
    ipcRenderer.invoke('get-team-report-group'),
  setTeamReportGroup: (id: number | null): Promise<void> =>
    ipcRenderer.invoke('set-team-report-group', id),
  getGroupMRsInTimeframe: (groupId: number, since: string, until?: string): Promise<import('./shared/types').MergeRequest[]> =>
    ipcRenderer.invoke('get-group-mrs-in-timeframe', groupId, since, until),
  openReportWindow: (username: string, name: string, avatarUrl: string, timeframe: string, groupId: number): Promise<void> =>
    ipcRenderer.invoke('open-report-window', username, name, avatarUrl, timeframe, groupId),
  openMRWindow: (projectId: number, mrIid: number): Promise<void> =>
    ipcRenderer.invoke('open-mr-window', projectId, mrIid),
  exportReportPDF: (): Promise<boolean> =>
    ipcRenderer.invoke('export-report-pdf'),
  saveReportFile: (filename: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('save-report-file', filename, content),
  getChangelog: (): Promise<string | null> =>
    ipcRenderer.invoke('get-changelog'),
  setLastSeenVersion: (): Promise<void> =>
    ipcRenderer.invoke('set-last-seen-version'),
  getOwnerGroups: (): Promise<import('./shared/types').GitLabGroup[]> =>
    ipcRenderer.invoke('get-owner-groups'),
  setPinned: (pinned: boolean): Promise<void> =>
    ipcRenderer.invoke('set-pinned', pinned),
  onAppStateUpdated: (callback: (state: AppState) => void) => {
    ipcRenderer.on('app-state-updated', (_event, state: AppState) => callback(state))
    return () => ipcRenderer.removeAllListeners('app-state-updated')
  },
  onSyncStatusUpdated: (callback: (isSyncing: boolean) => void) => {
    ipcRenderer.on('sync-status-updated', (_event, isSyncing: boolean) => callback(isSyncing))
    return () => ipcRenderer.removeAllListeners('sync-status-updated')
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
  getMRByIid: (projectId: number, mrIid: number): Promise<import('./shared/types').MergeRequest> =>
    ipcRenderer.invoke('get-mr-by-iid', projectId, mrIid),
  getMRDiffs: (projectId: number, mrIid: number): Promise<import('./shared/types').MRDiff[]> =>
    ipcRenderer.invoke('get-mr-diffs', projectId, mrIid),
  getMRDiscussions: (projectId: number, mrIid: number): Promise<import('./shared/types').MRDiscussion[]> =>
    ipcRenderer.invoke('get-mr-discussions', projectId, mrIid),
  addMRNote: (projectId: number, mrIid: number, body: string): Promise<void> =>
    ipcRenderer.invoke('add-mr-note', projectId, mrIid, body),
  approveMR: (projectId: number, mrIid: number): Promise<void> =>
    ipcRenderer.invoke('approve-mr', projectId, mrIid),
  unapproveMR: (projectId: number, mrIid: number): Promise<void> =>
    ipcRenderer.invoke('unapprove-mr', projectId, mrIid),
  mergeMR: (projectId: number, mrIid: number, options?: { mergeWhenPipelineSucceeds?: boolean }): Promise<void> =>
    ipcRenderer.invoke('merge-mr', projectId, mrIid, options),
  closeMR: (projectId: number, mrIid: number): Promise<void> =>
    ipcRenderer.invoke('close-mr', projectId, mrIid),
  cancelPipeline: (projectId: number, pipelineId: number): Promise<void> =>
    ipcRenderer.invoke('cancel-pipeline', projectId, pipelineId),
  getCompareDiffs: (projectId: number, fromSha: string, toSha: string): Promise<import('./shared/types').MRDiff[]> =>
    ipcRenderer.invoke('get-compare-diffs', projectId, fromSha, toSha),
  getCommitDiffs: (projectId: number, sha: string): Promise<import('./shared/types').MRDiff[]> =>
    ipcRenderer.invoke('get-commit-diffs', projectId, sha),
  getMRAwardEmojis: (projectId: number, mrIid: number): Promise<import('./shared/types').MRAwardEmoji[]> =>
    ipcRenderer.invoke('get-mr-award-emojis', projectId, mrIid),
  addMRAwardEmoji: (projectId: number, mrIid: number, name: string): Promise<void> =>
    ipcRenderer.invoke('add-mr-award-emoji', projectId, mrIid, name),
  removeMRAwardEmoji: (projectId: number, mrIid: number, awardId: number): Promise<void> =>
    ipcRenderer.invoke('remove-mr-award-emoji', projectId, mrIid, awardId),
  getMRApprovals: (projectId: number, mrIid: number): Promise<{ approved_by: { user: import('./shared/types').GitLabUser }[] }> =>
    ipcRenderer.invoke('get-mr-approvals', projectId, mrIid),
})
