# Changelog

## [1.2.2] - 2026-05-12

### Bug Fixes

- **Windows: window not showing on launch** — replaced unreliable `wasOpenedAtLogin` API with an explicit `--openedAtLogin` command-line arg; the window was being hidden on every manual launch for users who had "Launch at Startup" enabled
- **macOS: startup/login item not working** — fixed `release-all.yml` CI workflow that incorrectly set `CSC_IDENTITY_AUTO_DISCOVERY=false` on the macOS job, producing unsigned/unnotarized builds that Gatekeeper and macOS Login Items (13+) reject
- **macOS: window not focused after tray click** — `app.dock.show()` is now properly awaited before `app.focus()` and `win.show()`, so the window receives focus correctly when revealed from a startup-hidden state
- **Recreated window stuck hidden** — added `isInitialLaunch` guard so startup-hidden logic only applies on first launch; windows recreated after being destroyed always show as expected

---

## [1.2.0] - 2026-05-11

### Performance

- **Pipeline fetch parallelization** — pipeline status fetching now starts immediately when review MRs resolve, running in parallel with `getAllOpenMRs` instead of waiting for it to finish
- **Pipeline API throttling** — pipeline calls are batched in chunks of 5 (instead of firing all N calls at once) to avoid GitLab rate limit bursts
- **Cache current user** — `getCurrentUser()` is cached per scheduler run; saves 1 API call every sync cycle, resets when settings change
- **Reduce pipeline payload** — `getMRPipelines` now requests `per_page=1` since only the latest pipeline status is needed
- **Memoize TeamReport list** — `filtered` and `sorted` in TeamReport are wrapped in `useMemo`, preventing unnecessary recalculation on card expand/collapse
- **Prune notifiedMRIds** — `notifiedMRIds` in the store is pruned after each sync to only keep active open MR IDs (capped at 500), preventing unbounded disk/memory growth over time

---

## [1.1.1] - 2026-05-11

### Bug Fixes

- **macOS auto-update restart** — fixed app not reopening after installing an update on macOS; now uses `quitAndInstall(false, true)` to properly relaunch
- **macOS tray icon** — fixed tray icon invisible on macOS by using `createFromBuffer(fs.readFileSync())` instead of `createFromPath()` (incompatible with `.asar` archives)
- **macOS Retina tray icon** — added explicit `addRepresentation({ scaleFactor: 2 })` for crisp @2x display
- **macOS startup window** — app no longer shows window on login startup; starts hidden in tray as expected

### Features

- **Team Report group filter** — added group selector to filter the Team Report to members of a specific GitLab group; preference is saved and restored on next launch

---

## [1.1.0] - 2026-05-07

### Features

- **Team Report** — new tab showing all developers with open MR activity (authored, reviewing, assigned, merged in last 30 days)
- **CI pipeline status** — pipeline status badge (`running` / `success` / `failed` / `canceled`) shown on each review MR card
- **CI failure notification** — desktop notification when a pipeline transitions from `running` → `failed` on a MR you're reviewing
- **Auto-update polling** — updater checks for new releases hourly in addition to on launch

### Bug Fixes

- **Duplicate process on launch** — fixed multiple Electron processes spawning when the app is opened while already running (single-instance lock on both macOS and Windows)
- **GitHub release draft** — releases are now published as public (set `releaseType: "release"` in electron-builder config)
- **Windows NSIS target** — switched to NSIS installer so auto-update works correctly on Windows

---

## [1.0.0] - 2026-05-06

- Initial release
- Dashboard showing GitLab MRs assigned for review
- Settings: GitLab URL, access token, refresh interval, project filter
- Webhook mode (local server, Cloudflare tunnel, Socket.IO relay)
- Polling mode fallback
- Desktop notifications for newly assigned MRs
- macOS and Windows builds via GitHub Actions
