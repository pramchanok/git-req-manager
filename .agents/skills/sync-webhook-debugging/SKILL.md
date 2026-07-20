---
name: sync-webhook-debugging
description: Diagnose or modify GitLab MR Manager synchronization, webhook delivery, Cloudflare Tunnel, Socket.IO relay, scheduler caches, or notification detection. Use for stale state, missed or duplicate notifications, polling failures, webhook setup/cleanup, relay problems, tunnel URLs, sync races, and real-time merge events.
---

# Sync and Webhook Debugging

## Trace before changing

Determine the active sync mode and trace one event end to end. Inspect `scheduler.ts`, `webhook.ts`, `tunnel.ts`, `socket-client.ts`, `index.ts`, `notifier.ts`, and `store.ts` under `src/main/`.

For polling, trace settings → `startScheduler()` → `syncNow()` → `GitLabClient` → transition detection → state callback → renderer. Check the `isSyncing` guard, partial failures, cached identity, pipeline TTL, group TTL, and previous-state maps.

For webhooks, trace GitLab hook → public URL or relay → local validation → routing → immediate merge handling or delayed sync. Verify IDs, action type, and secret configuration without printing secrets.

Managed hook cleanup must preserve `gitlab-mr-manager:<username>` ownership.

## Notification diagnosis

Distinguish event delivery, sync execution, API failure, transition baseline, disabled setting, persistent deduplication, and OS delivery. For duplicates, inspect real-time and polling paths plus the persistent notified-ID set; never remove deduplication as a shortcut.

Reset identity caches on URL/token changes, keep pipeline calls throttled, preserve intentional previous-good data on partial failure, and stop unused polling/tunnel/relay/webhook resources when modes change.

## Verification

Use focused logs without credentials. Test initial baseline separately from later transitions. Run `npm test` and `npm run build`; identify behavior requiring a live GitLab or relay environment.
