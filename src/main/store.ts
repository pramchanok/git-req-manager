import Store from 'electron-store'
import { safeStorage } from 'electron'
import type { Settings } from '../shared/types'

interface StoreSchema {
  gitlabUrl: string
  encryptedToken: string
  refreshIntervalMinutes: number
  projectIds: number[]
  webhookEnabled: boolean
  webhookPort: number
  webhookSecret: string
  webhookPublicUrl: string
  webhookUseTunnel: boolean
  launchAtStartup: boolean
}

const store = new Store<StoreSchema>({
  defaults: {
    gitlabUrl: 'https://gitlab.igenco.dev',
    encryptedToken: '',
    refreshIntervalMinutes: 5,
    projectIds: [],
    webhookEnabled: true,
    webhookPort: 3847,
    webhookSecret: '',
    webhookPublicUrl: 'https://ig-server-eoffice.igenco.dev/gitlab-webhook',
    webhookUseTunnel: false,
    launchAtStartup: false,
  },
})

export function getSettings(): Settings {
  const encryptedToken = store.get('encryptedToken', '')
  let accessToken = ''

  if (encryptedToken) {
    try {
      const buf = Buffer.from(encryptedToken, 'base64')
      accessToken = safeStorage.decryptString(buf)
    } catch {
      accessToken = ''
    }
  }

  return {
    gitlabUrl: store.get('gitlabUrl', 'https://gitlab.igenco.dev'),
    accessToken,
    refreshIntervalMinutes: store.get('refreshIntervalMinutes', 5),
    projectIds: store.get('projectIds', []),
    webhookEnabled: store.get('webhookEnabled', false),
    webhookPort: store.get('webhookPort', 3847),
    webhookSecret: store.get('webhookSecret', ''),
    webhookPublicUrl: store.get('webhookPublicUrl', 'https://ig-server-eoffice.igenco.dev/gitlab-webhook'),
    webhookUseTunnel: store.get('webhookUseTunnel', false),
    launchAtStartup: store.get('launchAtStartup', false),
  }
}

export function saveSettings(settings: Settings): void {
  store.set('gitlabUrl', settings.gitlabUrl)
  store.set('refreshIntervalMinutes', settings.refreshIntervalMinutes)
  store.set('projectIds', settings.projectIds)
  store.set('webhookEnabled', settings.webhookEnabled)
  store.set('webhookPort', settings.webhookPort)
  store.set('webhookSecret', settings.webhookSecret)
  store.set('webhookPublicUrl', settings.webhookPublicUrl)
  store.set('webhookUseTunnel', settings.webhookUseTunnel)
  store.set('launchAtStartup', settings.launchAtStartup)

  if (settings.accessToken) {
    const encrypted = safeStorage.encryptString(settings.accessToken)
    store.set('encryptedToken', encrypted.toString('base64'))
  }
}

export function isConfigured(): boolean {
  const url = store.get('gitlabUrl', '')
  const token = store.get('encryptedToken', '')
  return url.length > 0 && token.length > 0
}
