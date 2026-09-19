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

  test('mapDiff identifies generated lockfiles and sets collapsed flag', () => {
    const rawDiff = {
      old_path: 'package-lock.json',
      new_path: 'package-lock.json',
      a_mode: '100644',
      b_mode: '100644',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: '',
    }

    const diff = client.mapDiff(rawDiff)
    expect(diff.generatedFile).toBe(true)
    expect(diff.collapsed).toBe(true)
    expect(diff.tooLarge).toBe(false)
  })

  test('mapDiff respects too_large and collapsed from API response', () => {
    const rawDiff = {
      old_path: 'big-data.json',
      new_path: 'big-data.json',
      a_mode: '100644',
      b_mode: '100644',
      new_file: false,
      renamed_file: false,
      deleted_file: false,
      diff: '',
      too_large: true,
      collapsed: true,
    }

    const diff = client.mapDiff(rawDiff)
    expect(diff.tooLarge).toBe(true)
    expect(diff.collapsed).toBe(true)
  })
})

describe('GitLabClient Report Queries', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('fetches report candidates after the start without excluding later-updated MRs', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await client.getGroupMRsInTimeframe(42, '2026-07-01T00:00:00.000Z')

    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string)
    expect(requestUrl.searchParams.get('updated_after')).toBe('2026-07-01T00:00:00.000Z')
    expect(requestUrl.searchParams.has('updated_before')).toBe(false)
  })

  test('fetches a personal report using only the authenticated user filters', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response('[]', { status: 200 }))
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

  test('fetches group analytics from both created and updated activity streams', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await client.getGroupMRAnalyticsSince(42, '2026-01-01T00:00:00.000Z')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const urls = fetchMock.mock.calls.map(([url]: [string]) => new URL(url))
    expect(urls.some((url) => url.searchParams.get('created_after') === '2026-01-01T00:00:00.000Z')).toBe(true)
    expect(urls.some((url) => url.searchParams.get('updated_after') === '2026-01-01T00:00:00.000Z')).toBe(true)
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
    const fetchMock = vi.fn(async (_url: string) => new Response('401', { status: 401, statusText: 'Unauthorized' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(client.getCurrentUser()).rejects.toThrow('GitLab API Error: 401 Unauthorized')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('getMRRawDiff calls the raw_diffs endpoint', async () => {
    const rawDiffText = 'diff --git a/file.txt b/file.txt\n+hello'
    const fetchMock = vi.fn(async (_url: string) => new Response(rawDiffText, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const diff = await client.getMRRawDiff(123, 45)
    expect(diff).toBe(rawDiffText)
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string)
    expect(requestUrl.pathname).toContain('/projects/123/merge_requests/45/raw_diffs')
  })
})

describe('GitLabClient personal MR pagination', () => {
  afterEach(() => vi.unstubAllGlobals())

  test.each(['reviewer_id', 'author_id'] as const)('fetches every page with the %s filter intact', async (filter) => {
    const fetchMock = vi.fn(async (url: string) => {
      const params = new URL(url).searchParams
      expect(params.get(filter)).toBe('42')
      expect(params.get('scope')).toBe('all')
      expect(params.get('state')).toBe('opened')
      expect(params.get('per_page')).toBe('100')
      const page = Number(params.get('page'))
      const rows = Array.from({ length: page === 1 ? 100 : 1 }, (_, index) => ({
        id: (page - 1) * 100 + index + 1,
        author: { id: 42, name: 'Author' },
      }))
      return new Response(JSON.stringify(rows), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const api = new GitLabClient('https://gitlab.example/subpath/', 'token')

    const mrs = await (filter === 'reviewer_id' ? api.getMRsForReview(42) : api.getAuthoredOpenMRs(42))

    expect(mrs).toHaveLength(101)
    expect(mrs[100].id).toBe(101)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(new URL(fetchMock.mock.calls[0][0]).pathname).toBe('/subpath/api/v4/merge_requests')
  })

  test('propagates a later page failure instead of returning incomplete MR data', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(Array.from({ length: 100 }, (_, id) => ({ id, author: {} })))))
      .mockResolvedValueOnce(new Response('denied', { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(new GitLabClient('https://gitlab.com', 'token').getMRsForReview(42)).rejects.toThrow('403')
  })
})

describe('GitLabClient selected project refresh', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('rejects a partial project refresh so the scheduler can retain its previous snapshot', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (new URL(url).pathname.includes('/projects/2/')) {
        return new Response('Access denied', { status: 403 })
      }
      return new Response(JSON.stringify([{ id: 11, author: {} }]))
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(new GitLabClient('https://gitlab.com', 'token').getAllOpenMRs([1, 2, 3]))
      .rejects.toThrow('Project 2: GitLab API Error: 403')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  test('combines healthy selected projects including empty results', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const rows = new URL(url).pathname.includes('/projects/2/') ? [] : [{ id: 11, author: {} }]
      return new Response(JSON.stringify(rows))
    })
    vi.stubGlobal('fetch', fetchMock)

    const results = await new GitLabClient('https://gitlab.com', 'token').getAllOpenMRs([1, 2])
    expect(results.map((mr) => mr.id)).toEqual([11])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('GitLabClient bounded retries', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test.each([429, 503])('honors Retry-After seconds on HTTP %s', async (status) => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('busy', { status, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(new Response('{"id":7}'))
    vi.stubGlobal('fetch', fetchMock)
    const result = new GitLabClient('https://gitlab.com', 'token').getCurrentUser()

    await vi.advanceTimersByTimeAsync(1999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect((await result).id).toBe(7)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('honors Retry-After HTTP dates', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('busy', { status: 503, headers: { 'Retry-After': 'Sat, 19 Sep 2026 12:00:03 GMT' } }))
      .mockResolvedValueOnce(new Response('{"id":7}'))
    vi.stubGlobal('fetch', fetchMock)
    const result = new GitLabClient('https://gitlab.com', 'token').getCurrentUser()

    await vi.advanceTimersByTimeAsync(2999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await result
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test.each(['invalid', ''])('uses jittered exponential backoff for unusable Retry-After %j and stops after three attempts', async (retryAfter) => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const fetchMock = vi.fn(async () => new Response('busy', { status: 429, headers: { 'Retry-After': retryAfter } }))
    vi.stubGlobal('fetch', fetchMock)
    const result = expect(new GitLabClient('https://gitlab.com', 'token').getCurrentUser()).rejects.toThrow('429')

    await vi.advanceTimersByTimeAsync(374)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(624)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    await result
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  test('fails promptly when server asks for a delay above the retry budget', async () => {
    const fetchMock = vi.fn(async () => new Response('rate limited', { status: 429, headers: { 'Retry-After': '3600' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(new GitLabClient('https://gitlab.com', 'token').getCurrentUser()).rejects.toThrow('429')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('never retries a mutation even for a retryable response', async () => {
    const fetchMock = vi.fn(async () => new Response('busy', { status: 503, headers: { 'Retry-After': '1' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(new GitLabClient('https://gitlab.com', 'token').addMRNote(1, 2, 'hello')).rejects.toThrow('503')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
