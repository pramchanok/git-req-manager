import type { AppState, Settings, UpdateState } from '../../shared/types'

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
      onAppStateUpdated: (callback: (state: AppState) => void) => () => void
      onTunnelStatus: (callback: (status: { status: string; url?: string; message?: string; synced?: number; failed?: number }) => void) => () => void
      onUpdateStateChanged: (callback: (state: UpdateState) => void) => () => void
    }
  }
}

export {}
