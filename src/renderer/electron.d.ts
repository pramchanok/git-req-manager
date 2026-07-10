import type { AppState, GitLabGroup, GitLabUser, MergeRequest, Settings, UpdateState, MRAwardEmoji } from '../../shared/types'

declare global {
  interface Window {
    electronAPI: {
      getSettings: () => Promise<Settings>
      saveSettings: (settings: Settings) => Promise<void>
      getAppState: () => Promise<AppState>
      testNotification: () => Promise<void>
      triggerSync: () => Promise<void>
      openUrl: (url: string) => Promise<void>
      getUpdateState: () => Promise<UpdateState>
      checkForUpdates: () => Promise<UpdateState>
      installUpdate: () => Promise<void>
      getWebhookUrl: () => Promise<string | null>
      checkCloudflared: () => Promise<{ available: boolean; path: string | null }>
      getMergedMRsByAuthor: (username: string) => Promise<MergeRequest[]>
      getGitLabGroups: () => Promise<GitLabGroup[]>
      getGroupMembers: (groupId: number) => Promise<GitLabUser[]>
      getTeamReportGroup: () => Promise<number | null>
      setTeamReportGroup: (id: number | null) => Promise<void>
      getGroupMRsInTimeframe: (groupId: number, since: string, until?: string) => Promise<MergeRequest[]>
      openReportWindow: (username: string, name: string, avatarUrl: string, timeframe: string, groupId: number) => Promise<void>
      openMRWindow: (projectId: number, mrIid: number) => Promise<void>
      exportReportPDF: () => Promise<boolean>
      saveReportFile: (filename: string, content: string) => Promise<boolean>
      getChangelog: () => Promise<string | null>
      setLastSeenVersion: () => Promise<void>
      getOwnerGroups: () => Promise<GitLabGroup[]>
      getMRByIid: (projectId: number, mrIid: number) => Promise<import('../../shared/types').MergeRequest | null>
      getMRDiffs: (projectId: number, mrIid: number) => Promise<import('../../shared/types').MRDiff[]>
      getMRDiscussions: (projectId: number, mrIid: number) => Promise<import('../../shared/types').MRDiscussion[]>
      addMRNote: (projectId: number, mrIid: number, body: string) => Promise<void>
      approveMR: (projectId: number, mrIid: number) => Promise<void>
      unapproveMR: (projectId: number, mrIid: number) => Promise<void>
      mergeMR: (projectId: number, mrIid: number, options?: { mergeWhenPipelineSucceeds?: boolean }) => Promise<void>
      closeMR: (projectId: number, mrIid: number) => Promise<void>
      cancelPipeline: (projectId: number, pipelineId: number) => Promise<void>
      getCompareDiffs: (projectId: number, fromSha: string, toSha: string) => Promise<import('../../shared/types').MRDiff[]>
      getCommitDiffs: (projectId: number, sha: string) => Promise<import('../../shared/types').MRDiff[]>
      getMRAwardEmojis: (projectId: number, mrIid: number) => Promise<MRAwardEmoji[]>
      addMRAwardEmoji: (projectId: number, mrIid: number, name: string) => Promise<void>
      removeMRAwardEmoji: (projectId: number, mrIid: number, awardId: number) => Promise<void>
      onAppStateUpdated: (callback: (state: AppState) => void) => () => void
      onSyncStatusUpdated: (callback: (isSyncing: boolean) => void) => () => void
      onTunnelStatus: (callback: (status: { status: string; url?: string; message?: string; synced?: number; failed?: number }) => void) => () => void
      onUpdateStateChanged: (callback: (state: UpdateState) => void) => () => void
      onShowSettings: (callback: () => void) => () => void
      onShowChangelog: (callback: () => void) => () => void
    }
  }
}

export {}
