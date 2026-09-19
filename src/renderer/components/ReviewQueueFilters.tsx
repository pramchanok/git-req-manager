import { useEffect, useRef, useState } from 'react'
import type { MergeRequest } from '../../shared/types'
import { EMPTY_QUEUE_FILTERS, parseQueuePresets, queueStorageKey, type QueuePreset, type QueueFilters } from './review-queue'

const control = 'min-w-0 rounded-md border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-orange-400'

interface Props {
  mrs: MergeRequest[]
  current: QueuePreset
  userId?: number
  lastSyncedAt: string | null
  onChange: (filters: QueueFilters) => void
  onLoad: (preset: QueuePreset) => void
}

export default function ReviewQueueFilters({ mrs, current, userId, lastSyncedAt, onChange, onLoad }: Props) {
  const [scope, setScope] = useState('')
  const [presets, setPresets] = useState<QueuePreset[]>([])
  const [name, setName] = useState('')
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const scopeRef = useRef('')
  useEffect(() => {
    let disposed = false
    if (userId === undefined) { scopeRef.current = ''; setScope(''); setSelected(''); setPresets([]); return }
    window.electronAPI.getSettings().then(settings => {
      if (disposed) return
      const key = queueStorageKey(settings.gitlabUrl, userId)
      if (scopeRef.current !== key) setSelected('')
      scopeRef.current = key
      setPresets(parseQueuePresets(localStorage.getItem(key)))
      setScope(key)
      setError('')
    }).catch(() => { if (!disposed) { setScope(''); setPresets([]); setError('Saved filters are unavailable for this account.') } })
    return () => { disposed = true }
  }, [userId, lastSyncedAt])

  const persist = (next: QueuePreset[]) => {
    if (!scope) return
    try { localStorage.setItem(scope, JSON.stringify(next)); setPresets(next); setError('') }
    catch { setError('Could not save filters on this device.') }
  }
  const projects = [...new Map(mrs.map(mr => [String(mr.projectId), mr.projectNamespace || mr.projectName])).entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const labels = [...new Set(mrs.flatMap(mr => mr.labels.map(label => label.name)))].sort()
  const filters = current.filters
  return <div className="space-y-2 border-b border-gray-800 bg-gray-900/70 px-3 py-2">
    <div className="grid grid-cols-2 gap-2">
      <select aria-label="Filter by project" className={control} value={filters.projectId} onChange={event => onChange({ ...filters, projectId: event.target.value })}>
        <option value="">All projects</option>
        {filters.projectId && !projects.some(([id]) => id === filters.projectId) && <option value={filters.projectId}>Project {filters.projectId} (not loaded)</option>}
        {projects.map(([id, project]) => <option key={id} value={id}>{project}</option>)}
      </select>
      <select aria-label="Filter by label" className={control} value={filters.label} onChange={event => onChange({ ...filters, label: event.target.value })}>
        <option value="">All labels</option>
        {filters.label && !labels.includes(filters.label) && <option value={filters.label}>{filters.label} (not loaded)</option>}
        {labels.map(label => <option key={label}>{label}</option>)}
      </select>
    </div>
    <div className="flex flex-wrap gap-x-3 gap-y-2 text-[11px] text-gray-300">
      {([['hideDraft', 'Hide drafts'], ['ciPassed', 'Known CI passed'], ['stale', 'Unchanged >2 days']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-1.5"><input type="checkbox" className="accent-orange-500" checked={filters[key]} onChange={event => onChange({ ...filters, [key]: event.target.checked })} />{label}</label>)}
      <button className="text-orange-300 hover:underline" onClick={() => onChange({ ...EMPTY_QUEUE_FILTERS })}>Clear filters</button>
    </div>
    {filters.ciPassed && <p className="text-[10px] text-gray-500">MRs with unknown CI status are excluded.</p>}
    <div className="flex gap-2">
      <select aria-label="Saved review queue" disabled={!scope} value={selected} className={`${control} flex-1`} onChange={event => { setSelected(event.target.value); const preset = presets.find(item => item.name === event.target.value); if (preset) onLoad(preset) }}>
        <option value="">Saved filters…</option>
        {presets.map(preset => <option key={preset.name}>{preset.name}</option>)}
      </select>
      <button disabled={!selected || !scope} className="text-xs text-gray-400 hover:text-red-300 disabled:opacity-40" onClick={() => { persist(presets.filter(preset => preset.name !== selected)); setSelected('') }}>Delete</button>
    </div>
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); const trimmed = name.trim(); if (!trimmed || !scope) return; if (presets.some(preset => preset.name === trimmed)) { setError('That name already exists. Choose a different name.'); return } if (presets.length >= 30) { setError('Delete a saved filter before adding another (maximum 30).'); return } persist([...presets, { ...current, name: trimmed }]); setName('') }}>
      <input aria-label="New saved filter name" maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="Name this queue…" className={`${control} flex-1`} />
      <button disabled={!scope || !name.trim()} className="rounded-md bg-orange-500/15 px-2 text-xs text-orange-300 disabled:opacity-40">Save</button>
    </form>
    {error && <p role="status" className="text-xs text-amber-300">{error}</p>}
  </div>
}
