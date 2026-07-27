import { contextBridge, ipcRenderer } from 'electron'
import type { Settings, AppState, OpenFileInIDEResult, UpdateState, GitLabGroup } from './shared/types'

/**
 * Subscribe แบบผูกกับ handler ตัวเอง — ห้ามใช้ removeAllListeners เพราะหลาย component
 * ฟังช่องเดียวกันได้ (เช่น App กับ MRDetail ต่างก็ฟัง 'app-state-updated')
 * ตัวที่ unmount ก่อนจะลบ listener ของอีกตัวไปด้วย
 */
function subscribe<T extends unknown[]>(
  channel: string,
  callback: (...args: T) => void
): () => void {
  const handler = (_event: unknown, ...args: T) => callback(...args)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Settings): Promise<void> => ipcRenderer.invoke('save-settings', settings),
  getAppState: (): Promise<AppState> => ipcRenderer.invoke('get-app-state'),
  testNotification: (): Promise<void> => ipcRenderer.invoke('test-notification'),
  triggerSync: (): Promise<void> => ipcRenderer.invoke('trigger-sync'),
  openUrl: (url: string): Promise<void> => ipcRenderer.invoke('open-url', url),
  openFileInIDE: (projectId: number, projectName: string, relativePath: string): Promise<OpenFileInIDEResult> =>
    ipcRenderer.invoke('open-file-in-ide', projectId, projectName, relativePath),
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
  getGroupMRsInTimeframe: (groupId: number, since: string): Promise<import('./shared/types').MergeRequest[]> =>
    ipcRenderer.invoke('get-group-mrs-in-timeframe', groupId, since),
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
  shouldShowChangelog: (): Promise<boolean> =>
    ipcRenderer.invoke('should-show-changelog'),
  setLastSeenVersion: (): Promise<void> =>
    ipcRenderer.invoke('set-last-seen-version'),
  getOwnerGroups: (): Promise<import('./shared/types').GitLabGroup[]> =>
    ipcRenderer.invoke('get-owner-groups'),
  setPinned: (pinned: boolean): Promise<void> =>
    ipcRenderer.invoke('set-pinned', pinned),
  hideWindow: (): Promise<void> =>
    ipcRenderer.invoke('hide-window'),
  onAppStateUpdated: (callback: (state: AppState) => void) =>
    subscribe<[AppState]>('app-state-updated', callback),
  onSyncStatusUpdated: (callback: (isSyncing: boolean) => void) =>
    subscribe<[boolean]>('sync-status-updated', callback),
  onMRNoteEvent: (callback: (data: { projectId: number; mrIid: number }) => void) =>
    subscribe<[{ projectId: number; mrIid: number }]>('mr-note-event', callback),
  onTunnelStatus: (callback: (status: { status: string; url?: string; message?: string; synced?: number; failed?: number }) => void) =>
    subscribe<[{ status: string; url?: string; message?: string; synced?: number; failed?: number }]>('tunnel-status', callback),
  onUpdateStateChanged: (callback: (state: UpdateState) => void) =>
    subscribe<[UpdateState]>('update-state-changed', callback),
  onShowSettings: (callback: () => void) => subscribe<[]>('show-settings', callback),
  onShowChangelog: (callback: () => void) => subscribe<[]>('show-changelog', callback),
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
  mergeMR: (projectId: number, mrIid: number, options?: { mergeWhenPipelineSucceeds?: boolean; removeSourceBranch?: boolean }): Promise<void> =>
    ipcRenderer.invoke('merge-mr', projectId, mrIid, options),
  closeMR: (projectId: number, mrIid: number): Promise<void> =>
    ipcRenderer.invoke('close-mr', projectId, mrIid),
  cancelPipeline: (projectId: number, pipelineId: number): Promise<void> =>
    ipcRenderer.invoke('cancel-pipeline', projectId, pipelineId),
  getPipelineJobs: (projectId: number, pipelineId: number): Promise<import('./shared/types').PipelineJob[]> =>
    ipcRenderer.invoke('get-pipeline-jobs', projectId, pipelineId),
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
