import { useEffect, useRef, useState } from 'react'
import type { PipelineJob, PipelineJobStatus } from '../../../shared/types'
import {
  CheckCircle2, XCircle, Loader2, Clock, MinusCircle, ChevronsRight,
  Settings2, AlertTriangle, CircleDashed,
} from 'lucide-react'

interface PipelineMiniGraphProps {
  projectId: number
  pipelineId: number
  pipelineStatus: string | null
}

type StageStatus = PipelineJobStatus | 'warning'

interface StageGroup {
  name: string
  status: StageStatus
  jobs: PipelineJob[]
}

const STATUS_COLOR: Record<string, string> = {
  success: 'text-green-400',
  failed: 'text-red-400',
  warning: 'text-amber-400',
  running: 'text-blue-400',
  pending: 'text-amber-400',
  canceled: 'text-gray-400',
  skipped: 'text-gray-500',
  manual: 'text-gray-400',
  created: 'text-gray-500',
}

function statusColor(status: StageStatus): string {
  return STATUS_COLOR[status] ?? 'text-gray-500'
}

function StatusIcon({ status, className = 'w-4 h-4' }: { status: StageStatus; className?: string }) {
  const cls = `${className} ${statusColor(status)}`
  switch (status) {
    case 'success': return <CheckCircle2 className={cls} />
    case 'failed': return <XCircle className={cls} />
    case 'warning': return <AlertTriangle className={cls} />
    case 'running': return <Loader2 className={`${cls} animate-spin`} />
    case 'pending':
    case 'waiting_for_resource':
    case 'preparing':
    case 'scheduled': return <Clock className={cls} />
    case 'canceled': return <MinusCircle className={cls} />
    case 'skipped': return <ChevronsRight className={cls} />
    case 'manual': return <Settings2 className={cls} />
    default: return <CircleDashed className={cls} />
  }
}

/** สรุปสถานะรวมของ stage จาก jobs ภายใน (เลียนแบบ logic ของ GitLab mini graph) */
function stageStatus(jobs: PipelineJob[]): StageStatus {
  if (jobs.some((j) => j.status === 'failed' && !j.allowFailure)) return 'failed'
  if (jobs.some((j) => j.status === 'running')) return 'running'
  if (jobs.some((j) => ['pending', 'waiting_for_resource', 'preparing', 'scheduled'].includes(j.status))) return 'pending'
  if (jobs.some((j) => j.status === 'failed' && j.allowFailure)) return 'warning'
  if (jobs.every((j) => j.status === 'skipped')) return 'skipped'
  if (jobs.some((j) => j.status === 'canceled')) return 'canceled'
  if (jobs.some((j) => j.status === 'manual')) return 'manual'
  if (jobs.some((j) => j.status === 'created')) return 'created'
  return 'success'
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null
  const s = Math.round(seconds)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

/** Mini pipeline graph แบบ GitLab: จุดสถานะราย stage + hover เพื่อดู jobs ใน stage นั้น */
export default function PipelineMiniGraph({ projectId, pipelineId, pipelineStatus }: PipelineMiniGraphProps) {
  const [stages, setStages] = useState<StageGroup[]>([])
  const [openStage, setOpenStage] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const jobs = await window.electronAPI.getPipelineJobs(projectId, pipelineId)
        if (cancelled) return
        // API คืน jobs เรียงจากใหม่ไปเก่า — เรียงตาม id ก่อนเพื่อให้ stage ซ้าย→ขวาตรงกับลำดับจริง
        const byStage = new Map<string, PipelineJob[]>()
        for (const job of [...jobs].sort((a, b) => a.id - b.id)) {
          const list = byStage.get(job.stage) ?? []
          list.push(job)
          byStage.set(job.stage, list)
        }
        setStages([...byStage.entries()].map(([name, list]) => ({ name, status: stageStatus(list), jobs: list })))
      } catch {
        if (!cancelled) setStages([])
      }
    }
    load()
    // pipeline ยังวิ่งอยู่ → poll ทุก 10 วินาทีให้สถานะ stage อัปเดตตาม
    const interval = pipelineStatus === 'running' ? setInterval(load, 10000) : null
    return () => {
      cancelled = true
      if (interval) clearInterval(interval)
    }
  }, [projectId, pipelineId, pipelineStatus])

  if (stages.length === 0) return null

  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpenStage(null), 150)
  }
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }

  return (
    <div className="flex items-center gap-0.5 bg-gray-900/60 border border-gray-800/80 rounded-md px-2 py-1 shadow-sm">
      {stages.map((stage, idx) => (
        <div key={stage.name} className="flex items-center">
          {idx > 0 && <div className="w-2 h-[1px] bg-gray-700" />}
          <div
            className="relative"
            onMouseEnter={() => { cancelClose(); setOpenStage(stage.name) }}
            onMouseLeave={scheduleClose}
          >
            <button
              className="flex items-center justify-center p-0.5 rounded-full hover:bg-gray-700/50 transition-colors"
              title={`${stage.name}: ${stage.status}`}
            >
              <StatusIcon status={stage.status} />
            </button>

            {openStage === stage.name && (
              <div
                className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-50 min-w-[220px] max-w-[300px] bg-[#1c2128] border border-gray-700 rounded-lg shadow-xl shadow-black/40 overflow-hidden"
                onMouseEnter={cancelClose}
                onMouseLeave={scheduleClose}
              >
                <div className="px-3 py-2 border-b border-gray-700/60 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wide truncate">{stage.name}</span>
                  <StatusIcon status={stage.status} className="w-3.5 h-3.5 shrink-0" />
                </div>
                <div className="py-1 max-h-[240px] overflow-y-auto">
                  {stage.jobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => job.webUrl && window.electronAPI.openUrl(job.webUrl)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-700/40 transition-colors"
                      title={job.webUrl ? 'View job on GitLab' : undefined}
                    >
                      <StatusIcon status={job.status === 'failed' && job.allowFailure ? 'warning' : job.status} className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs text-gray-200 truncate flex-1">{job.name}</span>
                      {formatDuration(job.duration) && (
                        <span className="text-[10px] text-gray-500 font-mono shrink-0">{formatDuration(job.duration)}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
