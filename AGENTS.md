# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev           # Dev mode: builds main, starts Vite + tsc watch + Electron (must run from native terminal, not inside another Electron process)
npm run build         # Build renderer (Vite) + main (tsc)
npm start             # Run from dist/ (requires prior build)

npm run package:mac   # Local macOS .dmg — no publish
npm run package:win   # Local Windows .exe — no publish
npm run publish:mac   # Build + publish macOS release to GitHub Releases
npm run publish:win   # Build + publish Windows release to GitHub Releases
npm run publish:all   # Build + publish both platforms sequentially
```

`publish:*` requires `GH_TOKEN` env var with GitHub release write permission.

## Architecture

Electron app with strict process separation:

```
Main process (Node.js)     Renderer process (React)
src/main/                  src/renderer/
  index.ts  ←──IPC──────→   window.electronAPI
  scheduler.ts               App.tsx
  store.ts                   pages/Dashboard.tsx
  tray.ts                    pages/Settings.tsx
  webhook.ts                 components/MRCard.tsx
  tunnel.ts
  socket-client.ts
  notifier.ts
  updater.ts
src/shared/              ← imported by both sides
  types.ts
  gitlab.ts
src/preload.ts           ← contextBridge bridge
```

**IPC bridge** — all main↔renderer calls go through `preload.ts` which exposes `window.electronAPI`. Adding a new IPC channel requires changes in 3 places: `preload.ts` (expose), `src/main/index.ts` `setupIPC()` (handle), `src/renderer/electron.d.ts` (TypeScript type).

**Two TypeScript configs** — renderer uses `tsconfig.json` (ESNext modules, `noEmit`, bundled by Vite); main uses `tsconfig.main.json` (CommonJS, emits to `dist/`). Both share `src/shared/`.

**State flow** — `scheduler.ts` owns the in-memory `AppState`. On change it calls `onStateChange` callback (set in `index.ts`) which pushes state to the renderer via `mainWindow.webContents.send('app-state-updated', state)`. The renderer also calls `get-app-state` once on mount.

**Two sync modes** (mutually exclusive, toggled in Settings):
- **Polling** — `scheduler.ts` runs `syncNow()` on an interval
- **Webhook** — `webhook.ts` runs a local HTTP server; optionally exposed via Cloudflare tunnel (`tunnel.ts`) or a reverse proxy (`socket-client.ts` connects to a Socket.IO relay server)

**Token security** — `store.ts` encrypts the access token with Electron's `safeStorage` (OS keychain-backed) before writing to `electron-store`. Plain token is never persisted to disk.

**GitLab API** — `src/shared/gitlab.ts` wraps GitLab REST API v4 with axios. Uses `PRIVATE-TOKEN` header. Manages its own webhook upsert/cleanup per project using a description prefix `gitlab-mr-manager:<username>` to identify owned hooks.

## Build & Packaging Notes

**Apple Silicon (M3) cross-compilation** — always pass `--arch x64` explicitly for Windows builds; without it, electron-builder defaults to host arch (arm64), producing a Windows ARM64 binary that won't run on x64 machines.

**macOS code signing** — requires a valid Apple Developer certificate in Keychain. The `publish:all` script runs Mac and Windows as separate electron-builder invocations so `CSC_IDENTITY_AUTO_DISCOVERY=false` only applies to the Windows build.

**Notarization** — configured with `teamId: 57TK5HXL9A` in `package.json`. Requires internet access to `timestamp.apple.com` (HTTP port 80) during `codesign`. If the timestamp service returns an error, retry — it's usually transient.

**Dev mode inside Codex or another Electron process** — will fail with `mach_port_rendezvous: Permission denied`. Run `npm run dev` from a native terminal (iTerm, Terminal.app) instead.

**macOS quarantine** — apps downloaded from the internet get `com.apple.quarantine`. Remove with `xattr -cr "/path/to/App.app"` before opening.

## Known Gotchas

**nativeImage + .asar** — `nativeImage.createFromPath()` cannot read from `.asar` archives (packaged builds). Always use:
```ts
nativeImage.createFromBuffer(fs.readFileSync(path))
```
Applies to tray icons, app icons — anywhere `nativeImage` is used in main process.

**macOS Retina tray icons** — `@2x` filename convention is unreliable. Explicitly call `addRepresentation()`:
```ts
icon.addRepresentation({ scaleFactor: 2, buffer: fs.readFileSync(icon2xPath) });
```
Provide a 44×44px image for the 22×22 logical size.

**electron-builder GitHub publish with multi-platform sequential builds** — keep `"releaseType": "draft"` in `package.json` so that both macOS and Windows runners can upload to the same draft release. The draft release will be automatically published (non-draft) by the `finalize` job in `release-all.yml` using `gh release edit "v${VERSION}" --draft=false` after all platforms upload their assets.

**Auto-update target requirements** — Windows must use `nsis` target (not `portable`/`zip`). macOS needs both `dmg` + `zip` targets AND a signed build. Unsigned macOS builds silently skip the update check.

**Single-instance cleanup on quit** — use `cleanupSingleInstanceChannelSync()` (sync version) in the `before-quit` event. The async version won't complete before the process exits, leaving stale lock/socket files.

**IPC channel checklist** — adding any new IPC channel requires changes in **exactly 3 files**:
1. `src/preload.ts` — expose via `contextBridge`
2. `src/main/index.ts` `setupIPC()` — register `ipcMain.handle`
3. `src/renderer/electron.d.ts` — add TypeScript type

**electron-builder config** — packaging config lives in `package.json` `"build"` field. `electron-builder.config.ts` is not used by any npm script.
