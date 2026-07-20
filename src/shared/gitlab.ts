import type { GitLabUser, MergeRequest, MRLabel, GitLabProject, GitLabGroup, MRDiff, MRDiscussion, MRAwardEmoji, PipelineJob } from './types'

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
    const res = await fetch(url.toString(), {
      method,
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
      },
      body: options.data ? JSON.stringify(options.data) : undefined,
    })
    
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

  async getAccessibleProjects(): Promise<GitLabProject[]> {
    const projects: GitLabProject[] = []
    let page = 1

    while (true) {
      const { data } = await this.http.get('/projects', {
        params: {
          membership: true,
          per_page: 100,
          page,
          order_by: 'last_activity_at',
          sort: 'desc',
        },
      })
      if (data.length === 0) break
      projects.push(...data.map(this.mapProject))
      if (data.length < 100) break
      page++
    }

    return projects
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
    return data.map((p: Record<string, unknown>) => this.mapProject(p))
  }

  async getGroups(): Promise<GitLabGroup[]> {
    const groups: GitLabGroup[] = []
    let page = 1
    while (true) {
      const { data } = await this.http.get('/groups', {
        params: { per_page: 100, page, order_by: 'name', sort: 'asc' },
      })
      if (data.length === 0) break
      groups.push(...data.map((g: Record<string, unknown>) => this.mapGroup(g)))
      if (data.length < 100) break
      page++
    }
    return groups
  }

  async getOwnerGroups(): Promise<GitLabGroup[]> {
    const groups: GitLabGroup[] = []
    let page = 1
    while (true) {
      const { data } = await this.http.get('/groups', {
        params: { min_access_level: 50, per_page: 100, page, order_by: 'name', sort: 'asc' },
      })
      if (data.length === 0) break
      groups.push(...data.map((g: Record<string, unknown>) => this.mapGroup(g)))
      if (data.length < 100) break
      page++
    }
    return groups
  }

  async getGroupOpenMRs(groupId: number): Promise<MergeRequest[]> {
    const mrs: MergeRequest[] = []
    let page = 1
    while (true) {
      const { data } = await this.http.get(`/groups/${groupId}/merge_requests`, {
        params: { state: 'opened', per_page: 100, page, with_labels_details: true },
      })
      if (data.length === 0) break
      mrs.push(...data.map((mr: Record<string, unknown>) => this.mapMR(mr)))
      if (data.length < 100) break
      page++
    }
    return mrs
  }

  async getGroupMRsInTimeframe(groupId: number, since: string, until?: string): Promise<MergeRequest[]> {
    const mrs: MergeRequest[] = []
    let page = 1
    const params: Record<string, unknown> = {
      state: 'all',
      per_page: 100,
      updated_after: since,
      with_labels_details: true,
    }
    if (until) {
      params.updated_before = until
    }
    while (true) {
      const { data } = await this.http.get(`/groups/${groupId}/merge_requests`, {
        params: { ...params, page },
      })
      if (data.length === 0) break
      mrs.push(...data.map((mr: Record<string, unknown>) => this.mapMR(mr)))
      if (data.length < 100) break
      page++
    }
    return mrs
  }

  async getGroupMembers(groupId: number): Promise<GitLabUser[]> {
    const members: GitLabUser[] = []
    let page = 1
    while (true) {
      const { data } = await this.http.get(`/groups/${groupId}/members/all`, {
        params: { per_page: 100, page },
      })
      if (data.length === 0) break
      members.push(...data.map((u: Record<string, unknown>) => this.mapUser(u)))
      if (data.length < 100) break
      page++
    }
    return members
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
    return data.map((mr: Record<string, unknown>) => this.mapMR(mr))
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
    return data.map((mr: Record<string, unknown>) => this.mapMR(mr))
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
    for (let i = 0; i < ids.length; i++) {
      try {
        await this.upsertProjectWebhook(ids[i], webhookUrl, secret, username)
        success++
      } catch {
        failed++
      }
      onProgress?.(i + 1, ids.length)
    }
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
    return data.map((mr: Record<string, unknown>) => this.mapMR(mr))
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
      const mrs: MergeRequest[] = []
      let page = 1
      while (true) {
        const { data } = await this.http.get('/merge_requests', {
          params: {
            state: 'opened',
            per_page: 100,
            page,
            scope: 'all',
            with_labels_details: true,
          },
        })
        if (data.length === 0) break
        mrs.push(...data.map((mr: Record<string, unknown>) => this.mapMR(mr)))
        if (data.length < 100) break
        page++
      }
      return mrs
    }

    const results = await Promise.all(
      projectIds.map(async (id) => {
        const mrs: MergeRequest[] = []
        let page = 1
        try {
          while (true) {
            const { data } = await this.http.get(`/projects/${id}/merge_requests`, {
              params: { state: 'opened', per_page: 100, page, with_labels_details: true },
            })
            if (data.length === 0) break
            mrs.push(...data.map((mr: Record<string, unknown>) => this.mapMR(mr)))
            if (data.length < 100) break
            page++
          }
        } catch {
          // silent: skip failed projects
        }
        return mrs
      })
    )

    return results.flat()
  }

  private mapLabel(l: Record<string, unknown>): MRLabel {
    return {
      name: l.name as string,
      color: (l.color as string) ?? '#6b7280',
      textColor: (l.text_color as string) ?? '#ffffff',
    }
  }

  private mapGroup(g: Record<string, unknown>): GitLabGroup {
    return {
      id: g.id as number,
      name: g.name as string,
      fullPath: g.full_path as string,
      webUrl: g.web_url as string,
    }
  }

  private mapUser(u: Record<string, unknown>): GitLabUser {
    return {
      id: u.id as number,
      name: u.name as string,
      username: u.username as string,
      avatarUrl: u.avatar_url as string,
      webUrl: u.web_url as string,
      isAdmin: u.is_admin as boolean | undefined,
    }
  }

  private mapProject(p: Record<string, unknown>): GitLabProject {
    return {
      id: p.id as number,
      name: p.name as string,
      nameWithNamespace: p.name_with_namespace as string,
      webUrl: p.web_url as string,
      defaultBranch: p.default_branch as string,
    }
  }

  private mapMR(mr: Record<string, unknown>): MergeRequest {
    const refs = mr.references as Record<string, unknown> | undefined
    const projectId =
      typeof mr.project_id === 'number'
        ? mr.project_id
        : refs
          ? parseInt(String(refs.full ?? '').split('!')[0]) || 0
          : 0

    const rawAuthor = mr.author as Record<string, unknown>
    const rawAssignees = (mr.assignees as Record<string, unknown>[]) ?? []
    const rawReviewers = (mr.reviewers as Record<string, unknown>[]) ?? []

    const projectPathParts = String(
      (mr.references as Record<string, unknown> | undefined)?.full ?? ''
    ).split('!')
    const projectNamespace = projectPathParts[0] ?? ''
    const projectName = projectNamespace.split('/').pop() ?? ''

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
      assignees: rawAssignees.map(this.mapUser.bind(this)),
      reviewers: rawReviewers.map(this.mapUser.bind(this)),
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
      pipelineStatus: (mr.head_pipeline as Record<string, unknown> | undefined)?.status as MergeRequest['pipelineStatus'] ?? null,
      pipelineId: (mr.head_pipeline as Record<string, unknown> | undefined)?.id as number ?? null,
      pipelineWebUrl: (mr.head_pipeline as Record<string, unknown> | undefined)?.web_url as string ?? null,
      labels: Array.isArray(mr.labels)
        ? (mr.labels as Array<Record<string, unknown> | string>).map((l) =>
            typeof l === 'string'
              ? { name: l, color: '#6b7280', textColor: '#ffffff' }
              : this.mapLabel(l as Record<string, unknown>)
          )
        : [],
      userCanMerge: ((mr.user as Record<string, unknown> | undefined)?.can_merge as boolean) ?? false,
      hasApproved: (mr.has_approved as boolean) ?? false,
    }
  }
  // ────── In-App Review & MR Actions ──────

  async getMRDiffs(projectId: number, mrIid: number): Promise<MRDiff[]> {
    const { data } = await this.http.get(`/projects/${projectId}/merge_requests/${mrIid}/changes`)
    return (data.changes ?? []).map((change: Record<string, unknown>) => ({
      diff: change.diff as string,
      newPath: change.new_path as string,
      oldPath: change.old_path as string,
      aMode: change.a_mode as string,
      bMode: change.b_mode as string,
      newFile: change.new_file as boolean,
      renamedFile: change.renamed_file as boolean,
      deletedFile: change.deleted_file as boolean,
    }))
  }

  async getCompareDiffs(projectId: number, fromSha: string, toSha: string): Promise<MRDiff[]> {
    const { data } = await this.http.get(`/projects/${projectId}/repository/compare`, {
      params: { from: fromSha, to: toSha }
    })
    return (data.diffs ?? []).map((change: Record<string, unknown>) => ({
      diff: change.diff as string,
      newPath: change.new_path as string,
      oldPath: change.old_path as string,
      aMode: change.a_mode as string,
      bMode: change.b_mode as string,
      newFile: change.new_file as boolean,
      renamedFile: change.renamed_file as boolean,
      deletedFile: change.deleted_file as boolean,
    }))
  }

  async getCommitDiffs(projectId: number, sha: string): Promise<MRDiff[]> {
    const { data } = await this.http.get(`/projects/${projectId}/repository/commits/${sha}/diff`)
    return (data ?? []).map((change: Record<string, unknown>) => ({
      diff: change.diff as string,
      newPath: change.new_path as string,
      oldPath: change.old_path as string,
      aMode: change.a_mode as string,
      bMode: change.b_mode as string,
      newFile: change.new_file as boolean,
      renamedFile: change.renamed_file as boolean,
      deletedFile: change.deleted_file as boolean,
    }))
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
