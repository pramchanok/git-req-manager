import { describe, expect, it } from 'vitest'
import type { MergeRequest } from '../../shared/types'
import { EMPTY_QUEUE_FILTERS, filterReviewQueue, parseQueuePresets, queueStorageKey } from './review-queue'

const now = Date.parse('2026-09-19T12:00:00Z')
const mr = (fields: Partial<MergeRequest>): MergeRequest => ({
  id: 1, projectId: 10, title: 'Fix sync', projectName: 'Desktop',
  author: { name: 'Reviewer' }, labels: [{ name: 'bug' }],
  draft: false, pipelineStatus: 'success', updatedAt: '2026-09-16T12:00:00Z', ...fields,
} as MergeRequest)

describe('review queue', () => {
  it('combines project, label, draft, pipeline, stale and text filters', () => {
    const match = mr({})
    const rows = [match, mr({ projectId: 20 }), mr({ draft: true }), mr({ labels: [] }), mr({ pipelineStatus: null }), mr({ updatedAt: '2026-09-19T10:00:00Z' }), mr({ title: 'Other change' })]
    expect(filterReviewQueue(rows, { projectId: '10', label: 'bug', hideDraft: true, ciPassed: true, stale: true }, '  FIX ', now)).toEqual([match])
    expect(rows).toHaveLength(7)
  })
  it('uses last activity age, excluding exactly two days, invalid and future dates', () => {
    expect(filterReviewQueue([
      mr({ updatedAt: '2026-09-17T12:00:00Z' }), mr({ updatedAt: 'invalid' }),
      mr({ updatedAt: '2026-09-20T00:00:00Z' }), mr({ updatedAt: '2026-09-17T11:59:59Z' }),
    ], { ...EMPTY_QUEUE_FILTERS, stale: true }, '', now)).toHaveLength(1)
  })
  it('isolates host, installation path and account without URL credentials', () => {
    expect(queueStorageKey('https://gitlab.example.com/', 1)).toBe(queueStorageKey('https://gitlab.example.com', 1))
    expect(queueStorageKey('https://gitlab.example.com', 1)).not.toBe(queueStorageKey('https://gitlab.example.com', 2))
    expect(queueStorageKey('https://other.example.com', 1)).not.toBe(queueStorageKey('https://gitlab.example.com', 1))
    expect(queueStorageKey('https://gitlab.example.com/team', 1)).not.toBe(queueStorageKey('https://gitlab.example.com', 1))
    expect(queueStorageKey('https://user:secret@gitlab.example.com/?token=secret', 1)).not.toContain('secret')
  })
  it('rejects corrupt or obsolete saved filters', () => {
    const valid = { name: 'Ready', tab: 'myReviews', search: '', sort: 'updated_desc', filters: EMPTY_QUEUE_FILTERS }
    expect(parseQueuePresets('{broken')).toEqual([])
    expect(parseQueuePresets(JSON.stringify([valid, null, { ...valid, filters: {} }, { ...valid, sort: 'unknown' }]))).toEqual([valid])
  })
})
