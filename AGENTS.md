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

## Versioning Rules

**Always ask for permission before bumping the version**: Before running \
pm version\ or modifying the version in \package.json\, you MUST ask the user if they have already released the current version. Do not bump versions automatically without user confirmation.

## Manual Release Tagging Rules

- Use the manual `Release All Platforms` workflow as the canonical release path.
- After bumping version and updating `CHANGELOG.md`, test, commit, and push `main` **without creating a tag locally**.
- Enter the exact version when starting the workflow. The `prepare` job must validate `package.json`, `package-lock.json`, `CHANGELOG.md`, existing tags, and existing releases before builds start.
- Create `v${VERSION}` only in the `finalize` job after all platform builds succeed. Never force-move a release tag.
- If a command that creates or pushes a tag is canceled, inspect both local and remote tag state; cancellation can occur after the tag was already pushed.
- Delete an accidental tag only when it has no GitHub Release and the user explicitly approves deleting that exact local/remote tag.
- After editing a workflow, start a new manual run. Do not use **Re-run jobs** on an older run because GitHub uses that run's original workflow snapshot.

## UI and Design Rules

- **Premium Aesthetics**: Always prioritize a premium, modern design aesthetic (e.g., similar to VS Code, GitHub, or Vercel). Use rich colors, dark modes, glassmorphism, and dynamic animations where appropriate.
- **Metadata Placement**: Do not place long text or badges inline with main titles if it can cause awkward wrapping. Move metadata (Project names, Branches, Labels, Status Badges) into dedicated "Meta Rows" above or below the title.
- **Badges**: Use `rounded-md` for badges, add subtle shadows, and group related metadata together using icons (e.g., Lucide-react) for better scannability.

## Changelog Rules

- **Prepend New Versions**: When updating `CHANGELOG.md` with a new version, always use the `multi_replace_file_content` tool to insert the new version header and content directly ABOVE the previous version header. Do NOT replace or overwrite the previous version headers.

## NSIS Custom Installer UI — Lessons Learned

This project uses a custom NSIS installer UI (`assets/installer.nsh`) with a frameless, dark-mode splash screen. Here are critical lessons learned:

### Architecture
- **`oneClick: false`** is required in `package.json` `nsis` config to use custom page hooks (`customPageAfterChangeDir`, `customInstallMode`).
- **`customInstallMode` macro** with `$isForceCurrentInstall = "1"` skips the "Choose Installation Options" page so the installer goes straight to file extraction.
- **`customPageAfterChangeDir` macro** is the hook point for customizing the InstFiles page via `MUI_PAGE_CUSTOMFUNCTION_SHOW` and `MUI_PAGE_CUSTOMFUNCTION_LEAVE`.
- **`!ifndef BUILD_UNINSTALLER`** wrapper is required around install-only functions to prevent NSIS warning 6010 ("install function not referenced") during uninstaller generation.

### InstFiles Page Controls
The NSIS InstFiles page inner dialog (`#32770`) has **only these controls**:
- `1004` — Progress bar (`msctls_progress32`)
- `1006` — A static text label (header/detail text)
- `1016` — Details list (file extraction log)

**Controls 1027, 1028, etc. do NOT exist on this page.** Attempting `GetDlgItem` for non-existent IDs returns 0 (null handle).

### Text Rendering — Critical Gotcha
- **`CreateWindowEx` text controls get destroyed by dialog repaints.** When NSIS updates the progress bar, the inner dialog repaints its background, covering any dynamically created controls. This is because `CreateWindowEx` controls are not registered in the dialog's control list.
- **Solution: Bake text into the BMP image** using PowerShell + .NET `System.Drawing` (`scripts/generate-splash.ps1`). This renders Segoe UI font with ClearType antialiasing directly into the bitmap. Text becomes part of the image and cannot be overwritten by repaints.

### Progress Bar — Critical Gotcha
- **Do NOT reparent the progress bar** (via `SetParent`) to a different window. NSIS sends progress update messages to the original parent dialog. If the progress bar is reparented, it stops receiving updates and appears frozen/invisible.
- **Do NOT hide the inner dialog** (`ShowWindow $0 0`). The progress bar lives inside it and will also be hidden.
- **Keep the inner dialog visible** but set its background to match the splash color (`SetCtlColors $0 "" 0x111827`). Stretch it to cover the full window area.
- **`SetWindowTheme` with spaces** (`t " ", t " "`) removes the Windows visual theme from the progress bar for a flat look.
- **Progress bar color messages**: `PBM_SETBKCOLOR = 0x2001` (track bg), `PBM_SETBARCOLOR = 0x0409` (fill). Colors must be in **BGR format**, not RGB.
- Keep the InstFiles progress bar in determinate mode so it displays the real extraction percentage. Do not use `PBS_MARQUEE`/`PBM_SETMARQUEE` for visual animation.
- Animate the logo area with a native `SysAnimate32` control playing `assets/installer-logo.avi`. Native AVI playback continues during synchronous extraction, unlike NSIS script timers.
- Keep the custom installer window at 400x300 to match the Electron splash BrowserWindow, and generate its two-second logo loop at 30 FPS (60 frames).
- The installer is Unicode, so use `ACM_OPENW` (`0x0467`) to open the AVI. `ACM_OPENA` (`0x0464`) fails with the Unicode path and leaves the logo region empty. Keep the static logo baked into `splash.bmp` as fallback.

### BMP Image Generation
- Use `scripts/generate-splash.ps1` (PowerShell + .NET System.Drawing) for BMP generation with proper font rendering.
- NSIS bitmap controls only support `.bmp` format (no PNG transparency).
- Use `${BUILD_RESOURCES_DIR}` to reference files from the `assets/` folder during NSIS compilation.

### App Launch After Install
- **Do NOT pass `--first-run`** to the app executable in `onInstFilesLeave`. This flag causes `isFirstRun()` to return true, which makes the splash screen show for 2.5s and prevents the app from hiding to tray.
- Just use `Exec '"$INSTDIR\GitLab MR Manager.exe"'` without any flags.
