# System Improvements Plan

## Goal
Prioritize system stability first, then improve daily usability, then tighten security/data correctness.

## Phase 1 — Reliability & Observability (Do first)

1. **Reduce silent failures**
   - Replace swallowed `catch` blocks with actionable error messages.
   - Surface error category (GitLab API / webhook / tunnel / socket / updater).
   - Show latest sync failure reason in UI.

2. **Harden sync flow**
   - Use partial-success sync so one failing branch does not break the whole round.
   - Add retry/backoff for transient API failures.
   - Isolate owner-group/pipeline failures from main sync path.

3. **Webhook hardening**
   - Add request body size limit.
   - Add request timeout guards.
   - Validate webhook payload before triggering sync.

## Phase 2 — UX Improvements

4. **Dashboard filter/sort/search**
   - Filter by project/author/label/stale age/pipeline status.
   - Sort by updated time, oldest waiting, approvals pending.
   - Persist last used filter.

5. **Project selector UI**
   - Select projects from fetched list (instead of manual Project IDs).
   - Support multi-select + search.
   - Show inaccessible/failed projects clearly.

6. **Health/Status panel**
   - Centralize status for sync/webhook/tunnel/socket/updater.
   - Show last success/last error timestamps.

## Phase 3 — Security & Data Correctness

7. **Sanitize rendered changelog HTML**
   - Sanitize before `dangerouslySetInnerHTML`.
   - Block scripts/event handlers/unsafe URLs.

8. **Fix TeamReport merged-30d correctness**
   - Use merge-time based filtering (not created-time based).
   - Validate edge cases: old MR newly merged.

## Phase 4 — Engineering Baseline

9. **Add minimum test baseline**
   - Unit tests for mapping/parsing/scheduler critical logic.
   - Smoke test for main flow (settings → sync → render).

10. **Add release quality gate**
   - Enforce type/build/test before package/publish.
   - Fail fast in CI.

## Recommended implementation order
1. Phase 1
2. Phase 2 (items 4–5)
3. Phase 3
4. Phase 4
