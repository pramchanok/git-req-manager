import { describe, expect, it, vi } from 'vitest'
import { createRefreshQueue, mrStorageScope } from './mrWorkspace'

describe('MR refresh queue', () => {
  it('runs one request at a time and coalesces a burst into a trailing refresh', async () => {
    const queue = createRefreshQueue()
    let release!: () => void
    const first = vi.fn(() => new Promise<void>(resolve => { release = resolve }))
    const stale = vi.fn(async () => {})
    const latest = vi.fn(async () => {})
    const pending = queue('notes', first)
    expect(queue('notes', stale)).toBe(pending)
    expect(queue('notes', latest)).toBe(pending)
    expect(latest).not.toHaveBeenCalled()
    release()
    await pending
    expect(first).toHaveBeenCalledTimes(1)
    expect(stale).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledTimes(1)
  })
  it('keeps independent endpoints concurrent and recovers after rejection', async () => {
    const queue = createRefreshQueue()
    let release!: () => void
    const pending = queue('notes', () => new Promise<void>(resolve => { release = resolve }))
    const other = vi.fn(async () => {})
    await queue('emojis', other)
    expect(other).toHaveBeenCalledTimes(1)
    release()
    await pending
    await expect(queue('notes', async () => { throw new Error('offline') })).rejects.toThrow('offline')
    await queue('notes', other)
    expect(other).toHaveBeenCalledTimes(2)
  })
})

describe('MR workspace storage scope', () => {
  it('isolates hosts, accounts, projects and merge requests', () => {
    const scopes = [
      mrStorageScope('https://gitlab.test', 1, 2, 3),
      mrStorageScope('https://gitlab.other', 1, 2, 3),
      mrStorageScope('https://gitlab.test', 9, 2, 3),
      mrStorageScope('https://gitlab.test', 1, 9, 3),
      mrStorageScope('https://gitlab.test', 1, 2, 9),
      mrStorageScope('https://gitlab.test/subpath', 1, 2, 3),
    ]
    expect(new Set(scopes).size).toBe(scopes.length)
    expect(mrStorageScope('https://gitlab.test/', 1, 2, 3)).toBe(scopes[0])
  })
  it('does not persist URL credentials or query values in storage keys', () => {
    const scope = mrStorageScope('https://secret:token@gitlab.test/?token=secret', 1, 2, 3)
    expect(scope).not.toContain('secret')
    expect(scope).not.toContain('token')
  })
})
