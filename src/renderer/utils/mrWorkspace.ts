/** Coalesce refresh bursts into one active request and one trailing refresh. */
export function createRefreshQueue() {
  const jobs = new Map<string, { promise: Promise<void>; pending: (() => Promise<void>) | null }>()
  return (key: string, task: () => Promise<void>): Promise<void> => {
    const active = jobs.get(key)
    if (active) { active.pending = task; return active.promise }
    const entry = { promise: Promise.resolve(), pending: null as (() => Promise<void>) | null }
    jobs.set(key, entry)
    entry.promise = (async () => {
      let next: (() => Promise<void>) | null = task
      try {
        while (next) { await next(); next = entry.pending; entry.pending = null }
      } finally { jobs.delete(key) }
    })()
    return entry.promise
  }
}

export function mrStorageScope(host: string, userId: number, projectId: number, mrIid: number): string {
  const url = new URL(host)
  return `mr-workspace:${encodeURIComponent(url.origin + url.pathname.replace(/\/+$/, ''))}:${userId}:${projectId}:${mrIid}`
}
