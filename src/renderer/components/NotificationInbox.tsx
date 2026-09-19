import { useEffect, useState } from 'react'
import { Bell, CheckCheck, ChevronDown } from 'lucide-react'
import type { NotificationInboxState } from '../../shared/types'

export default function NotificationInbox() {
  const [state, setState] = useState<NotificationInboxState>({ entries: [], snoozed: {} })
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const refresh = () => window.electronAPI.getNotificationState().then(data => { if (active) setState(data) }).catch(() => { if (active) setError('Could not load notifications.') })
    void refresh()
    const unsubscribe = window.electronAPI.onNotificationInboxUpdated(() => { void refresh() })
    return () => { active = false; unsubscribe() }
  }, [])
  const run = async (action: () => Promise<void>) => {
    setError('')
    try { await action(); setState(await window.electronAPI.getNotificationState()) }
    catch { setError('Could not update notifications. Please try again.') }
  }
  const unread = state.entries.filter(entry => !entry.read).length
  return <section className="shrink-0 border-b border-gray-800 bg-gray-900/50 text-xs">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-gray-400 hover:text-white focus-visible:outline-orange-400">
      <Bell size={13} /><span>Notifications</span>
      {unread > 0 && <span className="rounded-md bg-orange-500/15 px-1.5 text-orange-300">{unread}</span>}
      <ChevronDown size={13} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div className="max-h-64 overflow-y-auto border-t border-gray-800 px-3 pb-3">
      <div className="flex items-center justify-between py-2 gap-2 text-[10px] text-gray-500"><span>Quiet hours & snoozed events stay here.</span>
        <button disabled={!unread} onClick={() => void run(() => window.electronAPI.markNotificationsRead())} className="flex shrink-0 items-center gap-1 text-blue-300 disabled:opacity-40"><CheckCheck size={12} /> Mark read</button>
      </div>
      {state.entries.length === 0 && <p className="py-3 text-gray-500">No notifications yet.</p>}
      {state.entries.map(entry => {
        const key = `${entry.projectId}:${entry.mrIid}`
        const until = state.snoozed[key]
        const snoozed = until && Date.parse(until) > Date.now()
        return <article key={entry.id} className={`mb-2 rounded-md border p-2 ${entry.read ? 'border-gray-800 bg-gray-950/30' : 'border-orange-500/20 bg-orange-500/5'}`}>
          <p className="font-medium text-gray-200">{entry.title}</p><p className="mt-1 whitespace-pre-line break-words text-gray-400">{entry.body}</p>
          <p className="mt-1 text-[10px] text-gray-500">{new Date(entry.createdAt).toLocaleString()}</p>
          {entry.projectId && entry.mrIid && <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className="text-blue-300 hover:underline" onClick={() => void run(() => window.electronAPI.openMRWindow(entry.projectId!, entry.mrIid!))}>Open MR</button>
            <select aria-label={`Snooze notifications for MR ${entry.mrIid}`} value={snoozed ? 'active' : '0'} onChange={event => void run(() => window.electronAPI.snoozeNotification(entry.projectId!, entry.mrIid!, Number(event.target.value)))} className="max-w-full rounded-md border border-gray-700 bg-gray-800 px-1 py-1 text-[10px] text-gray-300">
              <option value="0">Notifications on</option>{snoozed && <option value="active" disabled>Muted until {new Date(until).toLocaleString()}</option>}
              <option value="60">Mute this MR for 1 hour</option><option value="1440">Mute this MR for 1 day</option>
            </select>
          </div>}
        </article>
      })}
      {error && <p role="alert" className="text-red-300">{error}</p>}
    </div>}
  </section>
}
