import type { Settings } from '../../../shared/types'
import ToggleSwitch from './ToggleSwitch'
import { SHOW_TUNNEL_OPTION } from './flags'

export type TunnelStatus = 'idle' | 'starting' | 'connected' | 'stopped' | 'error' | 'not-found'
export type SyncInfo = { synced?: number; failed?: number }

interface WebhookSectionProps {
  settings: Settings
  onUpdate: (patch: Partial<Settings>) => void
  webhookUrl: string | null
  tunnelStatus: TunnelStatus
  tunnelUrl: string | null
  cloudflaredAvailable: boolean | null
  syncInfo: SyncInfo | null
  copied: boolean
  onCopyWebhookUrl: () => void
}

/** ส่วนตั้งค่า Real-time Webhook (relay URL / tunnel / manual) */
export default function WebhookSection({
  settings,
  onUpdate,
  webhookUrl,
  tunnelStatus,
  tunnelUrl,
  cloudflaredAvailable,
  syncInfo,
  copied,
  onCopyWebhookUrl,
}: WebhookSectionProps) {
  const displayUrl = tunnelUrl
    ? `${tunnelUrl}/webhook`
    : (settings.webhookPublicUrl.trim() || webhookUrl) ?? null

  return (
    <div className="border-t border-gray-700 pt-2">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-gray-300">⚡ Real-time Webhook</p>
          <p className="text-xs text-gray-600 mt-0.5">รับ event จาก GitLab ทันทีโดยไม่ต้อง poll</p>
        </div>
        <ToggleSwitch
          checked={settings.webhookEnabled}
          onChange={() => onUpdate({ webhookEnabled: !settings.webhookEnabled })}
        />
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
                  onUpdate({ webhookPort: port })
                }}
                className="bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-orange-400"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-gray-400">Secret Token</label>
              <input
                type="password"
                value={settings.webhookSecret}
                onChange={(e) => onUpdate({ webhookSecret: e.target.value })}
                placeholder="optional"
                className="bg-gray-800 border border-gray-600 rounded px-2.5 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-400"
              />
            </div>
          </div>

          {/* Cloudflare Tunnel toggle */}
          {SHOW_TUNNEL_OPTION && (
          <div className="bg-gray-800 border border-gray-700 rounded p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-300">☁️ Auto Cloudflare Tunnel</p>
                <p className="text-xs text-gray-600">รับ URL สาธารณะอัตโนมัติ ฟรี ไม่ต้อง setup</p>
              </div>
              <ToggleSwitch
                checked={settings.webhookUseTunnel}
                onChange={() => onUpdate({ webhookUseTunnel: !settings.webhookUseTunnel })}
                color="blue"
              />
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
          )}

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
                onChange={(e) => onUpdate({ webhookPublicUrl: e.target.value })}
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
                  onClick={onCopyWebhookUrl}
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
  )
}
