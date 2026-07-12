import { useState, useEffect } from 'react'
import type { GitLabGroup, Settings, UpdateState } from '../../shared/types'
import type { ToastType } from '../components/Toast'
import ProjectSelector from '../components/ProjectSelector'

interface SettingsPageProps {
  onSaved: () => void
  onToast?: (message: string, type?: ToastType) => void
  onShowChangelog: () => void
  updateState: UpdateState
  onCheckForUpdates: () => Promise<unknown>
  onInstallUpdate: () => Promise<unknown>
}

type TunnelStatus = 'idle' | 'starting' | 'connected' | 'stopped' | 'error' | 'not-found'
type SyncInfo = { synced?: number; failed?: number }

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
  launchAtStartup: false,
  notifyOwnerGroupIds: [],
  notifyOnMyMRMerged: true,
}

function getUpdateMessageClass(status: UpdateState['status']): string {
  switch (status) {
    case 'checking':
    case 'available':
    case 'downloading':
      return 'text-blue-300'
    case 'downloaded':
      return 'text-green-300'
    case 'error':
      return 'text-red-400'
    default:
      return 'text-gray-400'
  }
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

  const displayUrl = tunnelUrl
    ? `${tunnelUrl}/webhook`
    : (settings.webhookPublicUrl.trim() || webhookUrl) ?? null

  const updateActionDisabled = updateState.status === 'checking' || updateState.status === 'downloading'
  const updateActionLabel = updateState.status === 'checking'
    ? 'Checking…'
    : updateState.status === 'downloading'
      ? `Downloading${updateState.progressPercent !== null ? ` ${updateState.progressPercent}%` : '…'}`
      : 'Check for Updates'

  return (
    <div className="flex flex-col h-full overflow-y-auto scroll-hide px-4 py-4 gap-4">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Settings</h2>

      {/* GitLab */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">GitLab URL</label>
        <input
          type="url"
          value={settings.gitlabUrl}
          onChange={(e) => setSettings({ ...settings, gitlabUrl: e.target.value })}
          placeholder="https://gitlab.igenco.dev"
          className="bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-400"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">Personal Access Token</label>
        <input
          type="password"
          value={settings.accessToken}
          onChange={(e) => setSettings({ ...settings, accessToken: e.target.value })}
          placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
          className="bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-400"
        />
        <p className="text-xs text-gray-600">
          Scope ที่ต้องการ:{' '}
          <span className="text-gray-400">read_api</span>
          {settings.webhookEnabled && settings.webhookUseTunnel && (
            <span className="text-yellow-500"> + api (สำหรับ auto-manage webhook)</span>
          )}
        </p>
      </div>

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
            setSettings({ ...settings, refreshIntervalMinutes: parseInt(e.target.value) || 5 })
          }
          className="bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-orange-400 w-24"
          disabled={settings.webhookEnabled}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">Tracked Projects</label>
        <ProjectSelector 
          selectedIds={settings.projectIds} 
          onChange={(ids) => setSettings({ ...settings, projectIds: ids })} 
        />
      </div>

      {/* Launch at Startup */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-300">🚀 เริ่มพร้อมเปิดเครื่อง</p>
          <p className="text-xs text-gray-600 mt-0.5">รันใน tray โดยอัตโนมัติ</p>
        </div>
        <button
          onClick={() => setSettings({ ...settings, launchAtStartup: !settings.launchAtStartup })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            settings.launchAtStartup ? 'bg-orange-500' : 'bg-gray-600'
          }`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            settings.launchAtStartup ? 'translate-x-4' : 'translate-x-1'
          }`} />
        </button>
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
          <button
            onClick={() => setSettings({ ...settings, notifyOnMyMRMerged: !settings.notifyOnMyMRMerged })}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
              settings.notifyOnMyMRMerged ? 'bg-orange-500' : 'bg-gray-600'
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              settings.notifyOnMyMRMerged ? 'translate-x-4' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Owner Group Notifications */}
      {(ownerGroupsLoading || ownerGroups.length > 0) && (
        <div className="border-t border-gray-700 pt-2 flex flex-col gap-2">
          <div>
            <p className="text-xs font-semibold text-gray-300">👑 Owner Group Notifications</p>
            <p className="text-xs text-gray-600 mt-0.5">แจ้งเตือน MR ใหม่ทุกอันใน Group ที่คุณเป็น Owner</p>
          </div>
          {ownerGroupsLoading ? (
            <p className="text-xs text-gray-600 animate-pulse">กำลังโหลด Groups…</p>
          ) : (
            ownerGroups.map((group) => {
              const enabled = (settings.notifyOwnerGroupIds ?? []).includes(group.id)
              return (
                <div key={group.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-300 truncate">{group.name}</p>
                    <p className="text-xs text-gray-600 truncate">{group.fullPath}</p>
                  </div>
                  <button
                    onClick={() => toggleOwnerGroup(group.id)}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                      enabled ? 'bg-orange-500' : 'bg-gray-600'
                    }`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      enabled ? 'translate-x-4' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Webhook */}
      <div className="border-t border-gray-700 pt-2">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold text-gray-300">⚡ Real-time Webhook</p>
            <p className="text-xs text-gray-600 mt-0.5">รับ event จาก GitLab ทันทีโดยไม่ต้อง poll</p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, webhookEnabled: !settings.webhookEnabled })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              settings.webhookEnabled ? 'bg-orange-500' : 'bg-gray-600'
            }`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              settings.webhookEnabled ? 'translate-x-4' : 'translate-x-1'
            }`} />
          </button>
        </div>

        {settings.webhookEnabled && (
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-gray-400">Port</label>
                <input
                  type="number"
                  min={1024}
                  max={65535}
                  value={settings.webhookPort}
                  onChange={(e) => {
                    const port = parseInt(e.target.value) || 3847
                    setSettings({ ...settings, webhookPort: port })
                  }}
                  className="bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-orange-400"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-xs text-gray-400">Secret Token</label>
                <input
                  type="password"
                  value={settings.webhookSecret}
                  onChange={(e) => setSettings({ ...settings, webhookSecret: e.target.value })}
                  placeholder="optional"
                  className="bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-400"
                />
              </div>
            </div>

            {/* Cloudflare Tunnel toggle */}
            <div className="bg-gray-800 border border-gray-700 rounded p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-300">☁️ Auto Cloudflare Tunnel</p>
                  <p className="text-xs text-gray-600">รับ URL สาธารณะอัตโนมัติ ฟรี ไม่ต้อง setup</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, webhookUseTunnel: !settings.webhookUseTunnel })}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    settings.webhookUseTunnel ? 'bg-blue-500' : 'bg-gray-600'
                  }`}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    settings.webhookUseTunnel ? 'translate-x-4' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {settings.webhookUseTunnel && (
                <div className="text-xs">
                  {cloudflaredAvailable === false && (
                    <div className="text-yellow-400">
                      ⚠️ ไม่พบ cloudflared —{' '}
                      <span
                        className="underline cursor-pointer"
                        onClick={() => window.electronAPI.openUrl('https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/')}
                      >
                        ดาวน์โหลดที่นี่
                      </span>
                      {' '}แล้ว restart app
                    </div>
                  )}
                  {cloudflaredAvailable === true && tunnelStatus === 'idle' && (
                    <p className="text-gray-500">กด Save &amp; Connect เพื่อเริ่ม tunnel</p>
                  )}
                  {tunnelStatus === 'starting' && (
                    <p className="text-blue-400 animate-pulse">⏳ กำลังเชื่อมต่อ tunnel…</p>
                  )}
                  {tunnelStatus === 'connected' && tunnelUrl && (
                    <div className="flex flex-col gap-0.5">
                      <p className="text-green-400">✓ Tunnel เชื่อมต่อแล้ว</p>
                      {syncInfo && (
                        <p className="text-green-300">
                          ✓ อัปเดต webhook ใน GitLab อัตโนมัติแล้ว {syncInfo.synced} project
                          {syncInfo.failed ? ` (${syncInfo.failed} ล้มเหลว)` : ''}
                        </p>
                      )}
                      {!syncInfo && (
                        <p className="text-blue-300 animate-pulse">⏳ กำลังอัปเดต webhook ใน GitLab…</p>
                      )}
                    </div>
                  )}
                  {tunnelStatus === 'not-found' && (
                    <p className="text-yellow-400">⚠️ ไม่พบ cloudflared — กรุณาติดตั้งก่อน</p>
                  )}
                  {tunnelStatus === 'error' && (
                    <p className="text-red-400">✗ Tunnel เกิดข้อผิดพลาด</p>
                  )}
                </div>
              )}
            </div>

            {/* Custom domain URL (when not using auto-tunnel) */}
            {!settings.webhookUseTunnel && (
              <div className="bg-gray-800 border border-gray-700 rounded p-3 flex flex-col gap-2">
                <div>
                  <p className="text-xs font-medium text-gray-300">🌐 Custom Webhook URL</p>
                  <p className="text-xs text-gray-600">ใช้ domain server ของคุณเอง — ตั้งครั้งเดียว ไม่ต้องเปลี่ยน</p>
                </div>
                <input
                  type="url"
                  value={settings.webhookPublicUrl}
                  onChange={(e) => setSettings({ ...settings, webhookPublicUrl: e.target.value })}
                  placeholder="https://yourdomain.com/gitlab-webhook"
                  className="bg-gray-700 border border-gray-600 rounded px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-400"
                />
                {syncInfo && (
                  <p className="text-xs text-green-300">
                    ✓ อัปเดต webhook ใน GitLab อัตโนมัติแล้ว {syncInfo.synced} project
                    {syncInfo.failed ? ` (${syncInfo.failed} ล้มเหลว)` : ''}
                  </p>
                )}
              </div>
            )}

            {/* Show manual webhook URL only when NOT using auto-tunnel */}
            {displayUrl && !settings.webhookUseTunnel && (
              <div className="bg-gray-800 border border-gray-700 rounded p-2">
                <p className="text-xs text-gray-400 mb-1">กรอก URL นี้ใน GitLab → Settings → Webhooks:</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-orange-300 flex-1 truncate">{displayUrl}</code>
                  <button
                    onClick={handleCopyWebhookUrl}
                    className="text-xs text-gray-400 hover:text-white flex-shrink-0"
                  >
                    {copied ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Events: <span className="text-gray-400">Merge request events</span>
                </p>
              </div>
            )}

            {!displayUrl && !settings.webhookUseTunnel && (
              <p className="text-xs text-gray-500">Webhook URL จะแสดงหลังจาก Save &amp; Connect</p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="mt-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 text-white text-sm font-medium rounded px-4 py-2 transition-colors"
      >
        {saving ? 'Saving…' : 'Save & Connect'}
      </button>

      <div className="border-t border-gray-700 pt-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-300">⬆️ App Updates</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Version {updateState.currentVersion ? `v${updateState.currentVersion}` : '—'} via GitHub Releases
            </p>
          </div>
          {updateState.status === 'downloaded' ? (
            <button
              onClick={() => void onInstallUpdate()}
              className="bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded px-3 py-1.5 transition-colors"
            >
              Restart to Update
            </button>
          ) : (
            <button
              onClick={() => void onCheckForUpdates()}
              disabled={updateActionDisabled}
              className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-500 text-white text-xs font-medium rounded px-3 py-1.5 transition-colors"
            >
              {updateActionLabel}
            </button>
          )}
        </div>

        {updateState.message && (
          <p className={`text-xs ${getUpdateMessageClass(updateState.status)}`}>{updateState.message}</p>
        )}

        {updateState.availableVersion && (
          <p className="text-xs text-gray-500">
            Latest detected: v{updateState.availableVersion}
          </p>
        )}

        {updateState.releaseDate && (
          <p className="text-xs text-gray-600">
            Release date: {new Date(updateState.releaseDate).toLocaleString()}
          </p>
        )}

        {updateState.releaseNotes && (updateState.status === 'available' || updateState.status === 'downloaded' || updateState.status === 'downloading') && (
          <details className="text-xs">
            <summary className="text-gray-400 cursor-pointer select-none hover:text-gray-300 transition-colors">
              สิ่งที่เปลี่ยนแปลงใน v{updateState.availableVersion}
            </summary>
            <div
              className="mt-2 p-2 bg-gray-800 rounded text-gray-400 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed"
              dangerouslySetInnerHTML={{ __html: updateState.releaseNotes }}
            />
          </details>
        )}

        <p className="text-xs text-gray-600">
          Packaged apps check for updates automatically on startup.
        </p>

        <button
          onClick={onShowChangelog}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-left"
        >
          📋 ดูสิ่งที่เปลี่ยนแปลงทั้งหมด
        </button>
      </div>
    </div>
  )
}
