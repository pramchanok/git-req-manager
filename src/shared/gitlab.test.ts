import { afterEach, describe, expect, test, vi } from 'vitest'
import { GitLabClient } from './gitlab'

// Hack: we need to instantiate it to access private mapMR / mapUser, 
// so we cast to any for testing purposes
const client = new GitLabClient('https://gitlab.com', 'token') as any

describe('GitLabClient Mappers', () => {
  test('mapUser parses user correctly', () => {
    const rawUser = {
      id: 1,
      name: 'John Doe',
      username: 'jdoe',
      avatar_url: 'https://avatar.com',
      web_url: 'https://gitlab.com/jdoe',
      is_admin: true
    }

    const user = client.mapUser(rawUser)
    
    expect(user.id).toBe(1)
    expect(user.name).toBe('John Doe')
    expect(user.isAdmin).toBe(true)
  })

  test('mapMR handles basic mapping', () => {
    const rawMR = {
      id: 10,
      iid: 5,
      project_id: 123,
      title: 'Update dependencies',
      description: 'Fixes security issues',
      state: 'opened',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      author: { id: 1, name: 'Alice', username: 'alice' },
      source_branch: 'feat/update',
      target_branch: 'main',
      web_url: 'https://gitlab.com/repo/-/merge_requests/5',
      labels: ['bug', 'frontend']
    }

    const mr = client.mapMR(rawMR)
    
    expect(mr.id).toBe(10)
    expect(mr.projectId).toBe(123)
    expect(mr.title).toBe('Update dependencies')
    expect(mr.author.name).toBe('Alice')
    expect(mr.labels.length).toBe(2)
    expect(mr.labels[0].name).toBe('bug')
    expect(mr.labels[0].color).toBe('#6b7280') // fallback color
  })

  test('mapMR handles nulls and missing fields safely', () => {
    const rawMR = {
      id: 10,
      iid: 5,
      project_id: 123,
      title: 'Test',
      author: { id: 1, name: 'Alice' },
    }

    const mr = client.mapMR(rawMR)
    expect(mr.description).toBe('')
    expect(mr.assignees).toEqual([])
    expect(mr.mergedBy).toBeNull()
    expect(mr.labels).toEqual([])
    expect(mr.approvalsRequired).toBe(0)
  })

  test('maps the actual merger from current and legacy GitLab fields', () => {
    const merger = { id: 2, name: 'Merger', username: 'merger', avatar_url: 'https://avatar.test/2', web_url: 'https://gitlab.com/merger' }
    const baseMR = {
      id: 10, iid: 5, project_id: 123, title: 'Merged change', state: 'merged',
      author: { id: 1, name: 'Alice', username: 'alice' }, source_branch: 'feature', target_branch: 'main', web_url: 'https://gitlab.com/mr/5',
    }

    expect(client.mapMR({ ...baseMR, merge_user: merger }).mergedBy.username).toBe('merger')
    expect(client.mapMR({ ...baseMR, merged_by: merger }).mergedBy.username).toBe('merger')
  })
})

describe('GitLabClient Report Queries', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('fetches report candidates after the start without excluding later-updated MRs', async () => {
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await client.getGroupMRsInTimeframe(42, '2026-07-01T00:00:00.000Z')

    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string)
    expect(requestUrl.searchParams.get('updated_after')).toBe('2026-07-01T00:00:00.000Z')
    expect(requestUrl.searchParams.has('updated_before')).toBe(false)
  })

  test('fetches a personal report using only the authenticated user filters', async () => {
    const fetchMock = vi.fn(async () => new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await client.getMyMRsInTimeframe(42, '2026-07-01T00:00:00.000Z')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const requestUrls = fetchMock.mock.calls.map(([url]: [string]) => new URL(url))
    expect(requestUrls.map((url) => url.searchParams.get('author_id'))).toContain('42')
    expect(requestUrls.map((url) => url.searchParams.get('reviewer_id'))).toContain('42')
    for (const url of requestUrls) {
      expect(url.searchParams.get('state')).toBe('all')
      expect(url.searchParams.get('updated_after')).toBe('2026-07-01T00:00:00.000Z')
    }
  })

  test('retries transient network failures for GET requests', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 7, name: 'Reviewer' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const user = await client.getCurrentUser()

    expect(user.id).toBe(7)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('does not retry authentication failures', async () => {
    const fetchMock = vi.fn(async () => new Response('401', { status: 401, statusText: 'Unauthorized' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(client.getCurrentUser()).rejects.toThrow('GitLab API Error: 401 Unauthorized')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
