---
name: gitlab-api-integration
description: Add, change, diagnose, or test GitLab REST API behavior in GitLab MR Manager. Use for projects, groups, merge requests, approvals, discussions, diffs, pipelines, webhooks, pagination, self-hosted compatibility, response mapping, API errors, or GitLabClient tests.
---

# GitLab API Integration

## Workflow

1. Inspect `src/shared/gitlab.ts`, `src/shared/types.ts`, and relevant tests.
2. Put GitLab HTTP behavior in `GitLabClient`; never call GitLab directly from React.
3. Reuse the configured base URL and `PRIVATE-TOKEN` request pattern.
4. Map raw responses to serializable shared domain types.
5. Use the Electron feature skill when the operation crosses into renderer UI.

## API rules

- Support `gitlab.com` and self-hosted base URLs.
- Encode paths and user-controlled query values.
- Handle pagination for collections; never assume the first page is complete.
- Preserve actionable error context without logging tokens or authorization headers.
- Use bounded concurrency for per-MR calls, following the scheduler pipeline pattern.
- Treat partial read failures deliberately when previous UI data can remain valid.

For managed webhooks, retain `gitlab-mr-manager:<username>` ownership and never delete unrelated hooks.

For mutations, accept narrow arguments, expose actionable authorization failures, refresh affected state after success, and avoid permanently divergent optimistic state.

## Verification

Add or update `src/shared/gitlab.test.ts` coverage for URL construction, pagination, mapping, and errors. Run `npm test`, then `npm run build` when types or IPC change.
