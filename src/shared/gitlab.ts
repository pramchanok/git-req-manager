import type { GitLabUser, MergeRequest, MRLabel, GitLabProject, GitLabGroup, MRDiff, MRDiscussion, MRAwardEmoji, PipelineJob } from './types'

// ทุก request มี timeout — ถ้าปล่อยค้าง scheduler จะติดธง isSyncing ไว้ตลอด
// แล้วรอบ sync ถัดๆ ไปจะถูก skip ทั้งหมดจนกว่าจะรีสตาร์ทแอป
const REQUEST_TIMEOUT_MS = 30_000

const PER_PAGE = 100
// กันลูป pagination ไม่รู้จบถ้า API ตอบผิดสัญญา (100 หน้า = 10,000 รายการ)
const MAX_PAGES = 100
// จำนวนโปรเจกต์ที่ดึง MR พร้อมกันได้สูงสุด
const PROJECT_FETCH_CONCURRENCY = 6
// จำนวนโปรเจกต์ที่ upsert webhook พร้อมกันได้สูงสุด
const WEBHOOK_SYNC_CONCURRENCY = 4

/** ยิงงานพร้อมกันแบบจำกัดจำนวน — กัน rate limit เวลาผู้ใช้เลือกโปรเจกต์ไว้เยอะ */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index])
    }
  })

  await Promise.all(workers)
  return results
}

class FetchWrapper {
  constructor(private baseUrl: string, private token: string) {}

  private async request(method: string, path: string, options: any = {}) {
    const url = new URL(`${this.baseUrl}${path}`)
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined && v !== null) {
          url.searchParams.append(k, String(v))
        }
      }
    }

    let res: Response
    try {
      res = await fetch(url.toString(), {
        method,
        headers: {
          'PRIVATE-TOKEN': this.token,
          'Content-Type': 'application/json',
        },
        body: options.data ? JSON.stringify(options.data) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'TimeoutError' || name === 'AbortError') {
        throw new Error(`GitLab API Timeout: ${method} ${path} took longer than ${REQUEST_TIMEOUT_MS}ms`)
      }
      throw err
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`GitLab API Error: ${res.status} ${res.statusText} ${errText}`)
    }

    const data: any = res.status !== 204 ? await res.json().catch(() => ({})) : {}
    return { data }
  }

  get(path: string, options?: any) { return this.request('GET', path, options) }
  post(path: string, data?: any) { return this.request('POST', path, { data }) }
  put(path: string, data?: any) { return this.request('PUT', path, { data }) }
  delete(path: string) { return this.request('DELETE', path) }
}

export class GitLabClient {
  private http: FetchWrapper

  constructor(baseUrl: string, accessToken: string) {
    const normalizedUrl = baseUrl.replace(/\/$/, '')
    this.http = new FetchWrapper(`${normalizedUrl}/api/v4`, accessToken)
  }

  async getCurrentUser(): Promise<GitLabUser> {
    const { data } = await this.http.get('/user')
    return this.mapUser(data)
  }

  /** ดึงครบทุกหน้าแบบ page-based — ใช้ร่วมกันทุก endpoint ที่ต้อง paginate */
  private async fetchAllPages<T>(
    path: string,
    params: Record<string, unknown>,
    map: (row: Record<string, unknown>) => T
  ): Promise<T[]> {
    const out: T[] = []

    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data } = await this.http.get(path, { params: { ...params, per_page: PER_PAGE, page } })
      if (!Array.isArray(data) || data.length === 0) break
      for (const row of data) out.push(map(row))
      if (data.length < PER_PAGE) break
    }

    return out
  }

  async getAccessibleProjects(): Promise<GitLabProject[]> {
    return this.fetchAllPages(
      '/projects',
      { membership: true, order_by: 'last_activity_at', sort: 'desc' },
      this.mapProject
    )
  }

  async searchProjects(query: string): Promise<GitLabProject[]> {
    const { data } = await this.http.get('/projects', {
      params: {
        search: query,
        membership: true,
        per_page: 50,
        order_by: 'last_activity_at',
        sort: 'desc',
      },
    })
    return data.map(this.mapProject)
  }

  async getGroups(): Promise<GitLabGroup[]> {
    return this.fetchAllPages('/groups', { order_by: 'name', sort: 'asc' }, this.mapGroup)
  }

  async getOwnerGroups(): Promise<GitLabGroup[]> {
    return this.fetchAllPages(
      '/groups',
      { min_access_level: 50, order_by: 'name', sort: 'asc' },
      this.mapGroup
    )
  }

  async getGroupOpenMRs(groupId: number): Promise<MergeRequest[]> {
    return this.fetchAllPages(
      `/groups/${groupId}/merge_requests`,
      { state: 'opened', with_labels_details: true },
      this.mapMR
    )
  }

  async getGroupMRsInTimeframe(groupId: number, since: string): Promise<MergeRequest[]> {
    return this.fetchAllPages(
      `/groups/${groupId}/merge_requests`,
      {
        state: 'all',
        updated_after: since,
        with_labels_details: true,
      },
      this.mapMR
    )
  }

  async getGroupMembers(groupId: number): Promise<GitLabUser[]> {
    return this.fetchAllPages(`/groups/${groupId}/members/all`, {}, this.mapUser)
  }

  async getMRsForReview(userId: number): Promise<MergeRequest[]> {
    const { data } = await this.http.get('/merge_requests', {
      params: {
        reviewer_id: userId,
        state: 'opened',
        per_page: 100,
        scope: 'all',
        with_labels_details: true,
      },
    })
    return data.map(this.mapMR)
  }

  async getAuthoredOpenMRs(authorId: number): Promise<MergeRequest[]> {
    const { data } = await this.http.get('/merge_requests', {
      params: {
        author_id: authorId,
        state: 'opened',
        per_page: 100,
        scope: 'all',
        with_labels_details: true,
      },
    })
    return data.map(this.mapMR)
  }

  async getMRByIid(projectId: number, mrIid: number): Promise<MergeRequest | null> {
    try {
      const { data } = await this.http.get(`/projects/${projectId}/merge_requests/${mrIid}`, {
        params: { with_labels_details: true },
      })
      return this.mapMR(data as Record<string, unknown>)
    } catch {
      return null
    }
  }


  // ────── Webhook Management ──────

  private static readonly HOOK_PREFIX = 'gitlab-mr-manager:'

  private hookDescription(username: string): string {
    return `${GitLabClient.HOOK_PREFIX}${username}`
  }

  async listProjectHooks(projectId: number): Promise<{ id: number; url: string; description?: string }[]> {
    try {
      const { data } = await this.http.get(`/projects/${projectId}/hooks`)
      return data
    } catch {
      return []
    }
  }

  async upsertProjectWebhook(projectId: number, webhookUrl: string, secret: string, username: string): Promise<void> {
    const hooks = await this.listProjectHooks(projectId)
    const myDesc = this.hookDescription(username)
    const legacyDesc = GitLabClient.HOOK_PREFIX.slice(0, -1)

    // Collect all hooks that belong to this app for this user (current + legacy format)
    const ours = hooks.filter(
      (h) => h.description === myDesc || h.description === legacyDesc
    )

    // Prefer the hook with the correct username description; fall back to legacy
    const keeper = ours.find((h) => h.description === myDesc) ?? ours[0]

    // Delete all duplicates except the one we'll keep/update
    for (const h of ours) {
      if (h !== keeper) {
        await this.http.delete(`/projects/${projectId}/hooks/${h.id}`).catch(() => {})
      }
    }

    const payload: Record<string, unknown> = {
      url: webhookUrl,
      merge_requests_events: true,
      pipeline_events: true,
      note_events: true,
      description: myDesc,
      enable_ssl_verification: webhookUrl.startsWith('https'),
    }
    if (secret) payload.token = secret

    if (keeper) {
      await this.http.put(`/projects/${projectId}/hooks/${keeper.id}`, payload)
    } else {
      await this.http.post(`/projects/${projectId}/hooks`, payload)
    }
  }

  async deleteOurProjectWebhook(projectId: number, username: string): Promise<void> {
    const hooks = await this.listProjectHooks(projectId)
    const existing = hooks.find((h) => h.description === this.hookDescription(username))
    if (existing) {
      await this.http.delete(`/projects/${projectId}/hooks/${existing.id}`)
    }
  }

  async syncWebhooksToAllProjects(
    webhookUrl: string,
    secret: string,
    projectIds: number[],
    username: string,
    onProgress?: (done: number, total: number) => void
  ): Promise<{ success: number; failed: number }> {
    let ids = projectIds
    if (ids.length === 0) {
      const projects = await this.getAccessibleProjects()
      ids = projects.map((p) => p.id)
    }

    let success = 0
    let failed = 0
    let done = 0

    await mapWithConcurrency(ids, WEBHOOK_SYNC_CONCURRENCY, async (id) => {
      try {
        await this.upsertProjectWebhook(id, webhookUrl, secret, username)
        success++
      } catch {
        failed++
      }
      onProgress?.(++done, ids.length)
    })

    return { success, failed }
  }

  // ────── MRs ──────

  async getMergedMRsByAuthor(authorUsername: string): Promise<MergeRequest[]> {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await this.http.get('/merge_requests', {
      params: {
        author_username: authorUsername,
        state: 'merged',
        per_page: 50,
        scope: 'all',
        created_after: since,
      },
    })
    return data.map(this.mapMR)
  }

  async getMRPipelines(projectId: number, mrIid: number): Promise<MergeRequest['pipelineStatus']> {
    try {
      const { data } = await this.http.get(`/projects/${projectId}/merge_requests/${mrIid}/pipelines`, {
        params: { per_page: 1 },
      })
      if (!Array.isArray(data) || data.length === 0) return null
      return (data[0].status as MergeRequest['pipelineStatus']) ?? null
    } catch {
      return null
    }
  }

  async getAllOpenMRs(projectIds: number[]): Promise<MergeRequest[]> {
    if (projectIds.length === 0) {
      return this.fetchAllPages(
        '/merge_requests',
        { state: 'opened', scope: 'all', with_labels_details: true },
        this.mapMR
      )
    }

    const results = await mapWithConcurrency(projectIds, PROJECT_FETCH_CONCURRENCY, async (id) => {
      try {
        return await this.fetchAllPages(
          `/projects/${id}/merge_requests`,
          { state: 'opened', with_labels_details: true },
          this.mapMR
        )
      } catch {
        return [] as MergeRequest[] // silent: skip failed projects
      }
    })

    return results.flat()
  }

  // mapper ทุกตัวประกาศเป็น arrow property — ส่งเข้า .map()/callback ได้ตรงๆ
  // โดยไม่ต้อง .bind(this) และไม่พังถ้าอนาคตมีการอ้าง this ข้างใน
  private mapLabel = (l: Record<string, unknown>): MRLabel => {
    return {
      name: l.name as string,
      color: (l.color as string) ?? '#6b7280',
      textColor: (l.text_color as string) ?? '#ffffff',
    }
  }

  private mapGroup = (g: Record<string, unknown>): GitLabGroup => {
    return {
      id: g.id as number,
      name: g.name as string,
      fullPath: g.full_path as string,
      webUrl: g.web_url as string,
    }
  }

  private mapUser = (u: Record<string, unknown>): GitLabUser => {
    return {
      id: u.id as number,
      name: u.name as string,
      username: u.username as string,
      avatarUrl: u.avatar_url as string,
      webUrl: u.web_url as string,
      isAdmin: u.is_admin as boolean | undefined,
    }
  }

  private mapProject = (p: Record<string, unknown>): GitLabProject => {
    return {
      id: p.id as number,
      name: p.name as string,
      nameWithNamespace: p.name_with_namespace as string,
      webUrl: p.web_url as string,
      defaultBranch: p.default_branch as string,
    }
  }

  private mapMR = (mr: Record<string, unknown>): MergeRequest => {
    const refs = mr.references as Record<string, unknown> | undefined
    const projectNamespace = String(refs?.full ?? '').split('!')[0] ?? ''
    const projectName = projectNamespace.split('/').pop() ?? ''

    const projectId =
      typeof mr.project_id === 'number'
        ? mr.project_id
        : parseInt(projectNamespace) || 0

    const rawAuthor = mr.author as Record<string, unknown>
    const rawAssignees = (mr.assignees as Record<string, unknown>[]) ?? []
    const rawReviewers = (mr.reviewers as Record<string, unknown>[]) ?? []

    const headPipeline = mr.head_pipeline as Record<string, unknown> | undefined

    return {
      id: mr.id as number,
      iid: mr.iid as number,
      projectId,
      projectName,
      projectNamespace,
      title: mr.title as string,
      description: (mr.description as string) ?? '',
      state: mr.state as MergeRequest['state'],
      createdAt: mr.created_at as string,
      updatedAt: mr.updated_at as string,
      mergedAt: (mr.merged_at as string | null) ?? null,
      author: this.mapUser(rawAuthor),
      assignees: rawAssignees.map(this.mapUser),
      reviewers: rawReviewers.map(this.mapUser),
      sha: (mr.sha as string) ?? null,
      sourceBranch: mr.source_branch as string,
      targetBranch: mr.target_branch as string,
      webUrl: mr.web_url as string,
      approvalsRequired: (mr.approvals_required as number) ?? 0,
      approvalsLeft: (mr.approvals_left as number) ?? 0,
      draft: (mr.draft as boolean) ?? false,
      hasConflicts: (mr.has_conflicts as boolean) ?? false,
      mergeWhenPipelineSucceeds: (mr.merge_when_pipeline_succeeds as boolean) ?? false,
      upvotes: (mr.upvotes as number) ?? 0,
      downvotes: (mr.downvotes as number) ?? 0,
      userNotesCount: (mr.user_notes_count as number) ?? 0,
      pipelineStatus: (headPipeline?.status as MergeRequest['pipelineStatus']) ?? null,
      pipelineId: (headPipeline?.id as number) ?? null,
      pipelineWebUrl: (headPipeline?.web_url as string) ?? null,
      labels: Array.isArray(mr.labels)
        ? (mr.labels as Array<Record<string, unknown> | string>).map((l) =>
            typeof l === 'string'
              ? { name: l, color: '#6b7280', textColor: '#ffffff' }
              : this.mapLabel(l)
          )
        : [],
      userCanMerge: ((mr.user as Record<string, unknown> | undefined)?.can_merge as boolean) ?? false,
      hasApproved: (mr.has_approved as boolean) ?? false,
    }
  }
  // ────── In-App Review & MR Actions ──────

  private mapDiff = (change: Record<string, unknown>): MRDiff => ({
    diff: change.diff as string,
    newPath: change.new_path as string,
    oldPath: change.old_path as string,
    aMode: change.a_mode as string,
    bMode: change.b_mode as string,
    newFile: change.new_file as boolean,
    renamedFile: change.renamed_file as boolean,
    deletedFile: change.deleted_file as boolean,
  })

  async getMRDiffs(projectId: number, mrIid: number): Promise<MRDiff[]> {
    const { data } = await this.http.get(`/projects/${projectId}/merge_requests/${mrIid}/changes`)
    return (data.changes ?? []).map(this.mapDiff)
  }

  async getCompareDiffs(projectId: number, fromSha: string, toSha: string): Promise<MRDiff[]> {
    const { data } = await this.http.get(`/projects/${projectId}/repository/compare`, {
      params: { from: fromSha, to: toSha }
    })
    return (data.diffs ?? []).map(this.mapDiff)
  }

  async getCommitDiffs(projectId: number, sha: string): Promise<MRDiff[]> {
    const { data } = await this.http.get(`/projects/${projectId}/repository/commits/${sha}/diff`)
    return (data ?? []).map(this.mapDiff)
  }

  async getMRDiscussions(projectId: number, mrIid: number): Promise<MRDiscussion[]> {
    const { data } = await this.http.get(`/projects/${projectId}/merge_requests/${mrIid}/discussions`, {
      params: { per_page: 100 }
    })
    return data.map((d: Record<string, unknown>) => ({
      id: d.id as string,
      replyId: d.reply_id as string,
      notes: (d.notes as Record<string, unknown>[]).map((n) => ({
        id: n.id as number,
        body: n.body as string,
        author: this.mapUser(n.author as Record<string, unknown>),
        createdAt: n.created_at as string,
        updatedAt: n.updated_at as string,
        system: n.system as boolean,
        resolvable: n.resolvable as boolean,
        resolved: n.resolved as boolean,
        type: n.type as string | null,
      })),
    }))
  }

  async addMRNote(projectId: number, mrIid: number, body: string): Promise<void> {
    await this.http.post(`/projects/${projectId}/merge_requests/${mrIid}/notes`, { body })
  }

  async getMRAwardEmojis(projectId: number, mrIid: number): Promise<MRAwardEmoji[]> {
    const { data } = await this.http.get(`/projects/${projectId}/merge_requests/${mrIid}/award_emoji`)
    return data.map((d: Record<string, unknown>) => ({
      id: d.id as number,
      name: d.name as string,
      user: this.mapUser(d.user as Record<string, unknown>),
      createdAt: d.created_at as string,
      updatedAt: d.updated_at as string,
    }))
  }

  async addMRAwardEmoji(projectId: number, mrIid: number, name: string): Promise<void> {
    await this.http.post(`/projects/${projectId}/merge_requests/${mrIid}/award_emoji`, { name })
  }

  async removeMRAwardEmoji(projectId: number, mrIid: number, awardId: number): Promise<void> {
    await this.http.delete(`/projects/${projectId}/merge_requests/${mrIid}/award_emoji/${awardId}`)
  }

  async getMRApprovals(projectId: number, mrIid: number): Promise<{ approved_by: { user: GitLabUser }[] }> {
    const { data } = await this.http.get(`/projects/${projectId}/merge_requests/${mrIid}/approvals`)
    return {
      approved_by: (data.approved_by || []).map((ab: Record<string, unknown>) => ({
        user: this.mapUser(ab.user as Record<string, unknown>)
      }))
    }
  }

  async approveMR(projectId: number, mrIid: number): Promise<void> {
    await this.http.post(`/projects/${projectId}/merge_requests/${mrIid}/approve`)
  }

  async unapproveMR(projectId: number, mrIid: number): Promise<void> {
    await this.http.post(`/projects/${projectId}/merge_requests/${mrIid}/unapprove`)
  }

  async mergeMR(projectId: number, mrIid: number, options?: { mergeWhenPipelineSucceeds?: boolean; removeSourceBranch?: boolean }): Promise<void> {
    await this.http.put(`/projects/${projectId}/merge_requests/${mrIid}/merge`, {
      should_remove_source_branch: options?.removeSourceBranch ?? true,
      ...(options?.mergeWhenPipelineSucceeds ? { merge_when_pipeline_succeeds: true } : {}),
    })
  }

  async cancelPipeline(projectId: number, pipelineId: number): Promise<void> {
    await this.http.post(`/projects/${projectId}/pipelines/${pipelineId}/cancel`)
  }

  async getPipelineJobs(projectId: number, pipelineId: number): Promise<PipelineJob[]> {
    const { data } = await this.http.get(`/projects/${projectId}/pipelines/${pipelineId}/jobs`, {
      params: { per_page: 100, include_retried: false },
    })
    return (data as Record<string, unknown>[]).map((job) => ({
      id: job.id as number,
      name: job.name as string,
      stage: job.stage as string,
      status: job.status as PipelineJob['status'],
      allowFailure: (job.allow_failure as boolean) ?? false,
      duration: (job.duration as number) ?? null,
      webUrl: (job.web_url as string) ?? null,
    }))
  }

  async closeMR(projectId: number, mrIid: number): Promise<void> {
    await this.http.put(`/projects/${projectId}/merge_requests/${mrIid}`, {
      state_event: 'close',
    })
  }
}
