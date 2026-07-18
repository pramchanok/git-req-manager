import { useState, useEffect } from 'react'
import type { GitLabGroup, Settings, UpdateState } from '../../shared/types'
import type { ToastType } from '../components/Toast'
import ProjectSelector from '../components/ProjectSelector'
import ToggleSwitch from '../components/settings/ToggleSwitch'
import UpdateCard from '../components/settings/UpdateCard'
import OwnerGroupsSection from '../components/settings/OwnerGroupsSection'
import WebhookSection, { TunnelStatus, SyncInfo } from '../components/settings/WebhookSection'
import { SHOW_TUNNEL_OPTION, SHOW_REFRESH_INTERVAL } from '../components/settings/flags'

interface SettingsPageProps {
  onSaved: () => void
  onToast?: (message: string, type?: ToastType) => void
  onShowChangelog: () => void
  updateState: UpdateState
  onCheckForUpdates: () => Promise<unknown>
  onInstallUpdate: () => Promise<unknown>
}

const DEFAULT_SETTINGS: Settings = {
  gitlabUrl: 'https://gitlab.igenco.dev',
  accessToken: '',
  refreshIntervalMinutes: 5,
  projectIds: [],
  webhookEnabled: true,
  webhookPort: 3847,
  webhookSecret: '',
  webhookPublicUrl: 'https://ig-server-eoffice.igenco.dev/gitlab-webhook',
  webhookUseTunnel: false,
  launchAtStartup: true,
  notifyOwnerGroupIds: [],
  notifyOnMyMRMerged: true,
}

export default function SettingsPage({
  onSaved,
  onToast,
  onShowChangelog,
  updateState,
  onCheckForUpdates,
  onInstallUpdate,
}: SettingsPageProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [cloudflaredAvailable, setCloudflaredAvailable] = useState<boolean | null>(null)
  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus>('idle')
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null)
  const [syncInfo, setSyncInfo] = useState<SyncInfo | null>(null)
  const [ownerGroups, setOwnerGroups] = useState<GitLabGroup[]>([])
  const [ownerGroupsLoading, setOwnerGroupsLoading] = useState(false)

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => {
      setSettings({
        ...s,
        webhookPublicUrl: s.webhookPublicUrl || DEFAULT_SETTINGS.webhookPublicUrl,
        notifyOwnerGroupIds: s.notifyOwnerGroupIds ?? [],
        // เมื่อซ่อน Tunnel option ให้บังคับปิดไว้ เพื่อไม่ให้ค่าเก่าค้างแบบมองไม่เห็น
        webhookUseTunnel: SHOW_TUNNEL_OPTION ? s.webhookUseTunnel : false,
      })
    })
    window.electronAPI.getWebhookUrl().then(setWebhookUrl)
    window.electronAPI.checkCloudflared().then(({ available }) => {
      setCloudflaredAvailable(available)
    })

    setOwnerGroupsLoading(true)
    window.electronAPI.getOwnerGroups()
      .then(setOwnerGroups)
      .catch(() => {})
      .finally(() => setOwnerGroupsLoading(false))

    const cleanup = window.electronAPI.onTunnelStatus((data) => {
      setTunnelStatus(data.status as TunnelStatus)
      if (data.url) {
        setTunnelUrl(data.url)
        setWebhookUrl(`${data.url}/webhook`)
      }
      if (data.synced !== undefined) {
        setSyncInfo({ synced: data.synced, failed: data.failed })
      }
    })
    return cleanup
  }, [])

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }

  const handleCopyWebhookUrl = () => {
    const url = tunnelUrl ? `${tunnelUrl}/webhook` : (settings.webhookPublicUrl.trim() || webhookUrl)
    if (url) {
      navigator.clipboard.writeText(url)
      onToast ? onToast('Webhook URL copied') : (setCopied(true), setTimeout(() => setCopied(false), 2000))
    }
  }

  const toggleOwnerGroup = (groupId: number) => {
    const current = settings.notifyOwnerGroupIds ?? []
    const updated = current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId]
    setSettings({ ...settings, notifyOwnerGroupIds: updated })
  }

  const handleSave = async () => {
    setError('')
    if (!settings.gitlabUrl.trim()) { setError('GitLab URL is required.'); return }
    if (!settings.accessToken.trim()) { setError('Personal Access Token is required.'); return }
    if (settings.refreshIntervalMinutes < 1 || settings.refreshIntervalMinutes > 120) {
      setError('Refresh interval must be between 1 and 120 minutes.'); return
    }
    if (settings.webhookEnabled && (settings.webhookPort < 1024 || settings.webhookPort > 65535)) {
      setError('Webhook port must be between 1024 and 65535.'); return
    }

    setSaving(true)
    try {
      await window.electronAPI.saveSettings(settings)
      if (settings.webhookEnabled && settings.webhookUseTunnel) {
        setTunnelStatus('starting')
        setTunnelUrl(null)
      }
      const url = await window.electronAPI.getWebhookUrl()
      setWebhookUrl(url)
      onToast?.('Settings saved')
      onSaved()
    } catch {
      setError('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto scroll-hide px-4 py-4 gap-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Settings</h2>

      {/* GitLab */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">GitLab URL</label>
        <input
          type="url"
          value={settings.gitlabUrl}
          onChange={(e) => updateSettings({ gitlabUrl: e.target.value })}
          placeholder="https://gitlab.igenco.dev"
          className="bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-400"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">Personal Access Token</label>
        <input
          type="password"
          value={settings.accessToken}
          onChange={(e) => updateSettings({ accessToken: e.target.value })}
          placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
          className="bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-400"
        />
        <p className="text-xs text-gray-600">
          Scope ที่ต้องการ:{' '}
          <span className="text-gray-400">api</span>
          <span className="text-gray-600"> (ใช้สำหรับ approve/merge/comment และ auto-manage webhook)</span>
        </p>
      </div>

      {SHOW_REFRESH_INTERVAL && (
      <div className={`flex flex-col gap-1 ${settings.webhookEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <label className="text-xs text-gray-400">
          Refresh Interval (minutes)
          {settings.webhookEnabled && <span className="ml-2 text-gray-600">— ปิดเพราะใช้ Webhook</span>}
        </label>
        <input
          type="number"
          min={1}
          max={120}
          value={settings.refreshIntervalMinutes}
          onChange={(e) =>
            updateSettings({ refreshIntervalMinutes: parseInt(e.target.value) || 5 })
          }
          className="bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-orange-400 w-24"
          disabled={settings.webhookEnabled}
        />
      </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">Tracked Projects</label>
        <ProjectSelector
          selectedIds={settings.projectIds}
          onChange={(ids) => updateSettings({ projectIds: ids })}
        />
      </div>

      {/* Launch at Startup */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-300">🚀 เริ่มพร้อมเปิดเครื่อง</p>
          <p className="text-xs text-gray-600 mt-0.5">รันใน tray โดยอัตโนมัติ</p>
        </div>
        <ToggleSwitch
          checked={settings.launchAtStartup}
          onChange={() => updateSettings({ launchAtStartup: !settings.launchAtStartup })}
        />
      </div>

      {/* Notifications section */}
      <div className="border-t border-gray-700 pt-2 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-300">🔔 Notifications</p>
          <button
            onClick={() => window.electronAPI.testNotification()}
            className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-700 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            Test Notification
          </button>
        </div>

        {/* Notify when my MR is merged */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-300">✅ แจ้งเตือนเมื่อ MR ของเราถูก Merge</p>
            <p className="text-xs text-gray-600 mt-0.5">รับแจ้งเตือนเมื่อ Merge Request ที่เราสร้างถูก merge แล้ว</p>
          </div>
          <ToggleSwitch
            checked={settings.notifyOnMyMRMerged}
            onChange={() => updateSettings({ notifyOnMyMRMerged: !settings.notifyOnMyMRMerged })}
            className="flex-shrink-0"
          />
        </div>
      </div>

      {/* Owner Group Notifications */}
      <OwnerGroupsSection
        ownerGroups={ownerGroups}
        loading={ownerGroupsLoading}
        selectedIds={settings.notifyOwnerGroupIds ?? []}
        onToggle={toggleOwnerGroup}
      />

      {/* Webhook */}
      <WebhookSection
        settings={settings}
        onUpdate={updateSettings}
        webhookUrl={webhookUrl}
        tunnelStatus={tunnelStatus}
        tunnelUrl={tunnelUrl}
        cloudflaredAvailable={cloudflaredAvailable}
        syncInfo={syncInfo}
        copied={copied}
        onCopyWebhookUrl={handleCopyWebhookUrl}
      />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 text-white text-sm font-medium rounded px-4 py-2 transition-colors"
      >
        {saving ? 'Saving…' : 'Save & Connect'}
      </button>

      <UpdateCard
        updateState={updateState}
        onCheckForUpdates={onCheckForUpdates}
        onInstallUpdate={onInstallUpdate}
        onShowChangelog={onShowChangelog}
      />
    </div>
  )
}
