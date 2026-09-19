import type { MergeRequest, MRTab } from '../../shared/types'

export type QueueSort = 'updated_desc' | 'updated_asc' | 'approvals_asc'
export interface QueueFilters {
  projectId: string
  label: string
  hideDraft: boolean
  ciPassed: boolean
  stale: boolean
}
export const EMPTY_QUEUE_FILTERS: QueueFilters = { projectId: '', label: '', hideDraft: false, ciPassed: false, stale: false }
export interface QueuePreset {
  name: string
  tab: MRTab
  search: string
  sort: QueueSort
  filters: QueueFilters
}

export function filterReviewQueue(mrs: MergeRequest[], filters: QueueFilters, search: string, now = Date.now()) {
  const query = search.trim().toLowerCase()
  return mrs.filter(mr =>
    (!filters.projectId || String(mr.projectId) === filters.projectId) &&
    (!filters.label || mr.labels.some(label => label.name === filters.label)) &&
    (!filters.hideDraft || !mr.draft) &&
    (!filters.ciPassed || mr.pipelineStatus === 'success') &&
    (!filters.stale || now - Date.parse(mr.updatedAt) > 2 * 24 * 60 * 60 * 1000) &&
    (!query || [mr.title, mr.author?.name, mr.projectName].some(value => value?.toLowerCase().includes(query)))
  )
}

export function queueStorageKey(gitlabUrl: string, userId: number) {
  const url = new URL(gitlabUrl)
  return `review-queue:v1:${encodeURIComponent(url.origin + url.pathname.replace(/\/+$/, ''))}:${userId}`
}

export function parseQueuePresets(raw: string | null): QueuePreset[] {
  try {
    const values: unknown = JSON.parse(raw || '[]')
    if (!Array.isArray(values)) return []
    return values.filter((value): value is QueuePreset => {
      if (!value || typeof value !== 'object') return false
      const f = value.filters
      return typeof value.name === 'string' && value.name.length > 0 && value.name.length <= 60 &&
        ['myReviews', 'allOpen'].includes(value.tab) && typeof value.search === 'string' &&
        ['updated_desc', 'updated_asc', 'approvals_asc'].includes(value.sort) && f &&
        typeof f.projectId === 'string' && typeof f.label === 'string' &&
        typeof f.hideDraft === 'boolean' && typeof f.ciPassed === 'boolean' && typeof f.stale === 'boolean'
    }).slice(0, 30)
  } catch { return [] }
}
