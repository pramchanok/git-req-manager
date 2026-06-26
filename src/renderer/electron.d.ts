import type { AppState, GitLabGroup, GitLabUser, MergeRequest, Settings, UpdateState } from '../../shared/types'

declare global {
  interface Window {
    electronAPI: {
      getSettings: () => Promise<Settings>
      saveSettings: (settings: Settings) => Promise<void>
      getAppState: () => Promise<AppState>
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
      exportReportPDF: () => Promise<boolean>
      saveReportFile: (filename: string, content: string) => Promise<boolean>
      getChangelog: () => Promise<string | null>
      setLastSeenVersion: () => Promise<void>
      getOwnerGroups: () => Promise<GitLabGroup[]>
      onAppStateUpdated: (callback: (state: AppState) => void) => () => void
      onTunnelStatus: (callback: (status: { status: string; url?: string; message?: string; synced?: number; failed?: number }) => void) => () => void
      onUpdateStateChanged: (callback: (state: UpdateState) => void) => () => void
      onShowSettings: (callback: () => void) => () => void
      onShowChangelog: (callback: () => void) => () => void
    }
  }
}

export {}
