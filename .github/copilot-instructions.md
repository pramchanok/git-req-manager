# GitHub Copilot Instructions

Electron desktop app (Windows + macOS) for tracking GitLab Merge Requests. Built with Electron + TypeScript + React + Vite + Tailwind CSS.

## Commands

```bash
npm run dev           # Dev mode: builds main, starts Vite + tsc watch + Electron
                      # Must run from a native terminal — not from inside another Electron process
npm run build         # Build both renderer (Vite) and main (tsc)
npm run build:main    # Compile main process TypeScript only
npm run build:renderer # Build React UI only
npm start             # Run app from dist/ (requires prior build)

npm run package:win   # Local Windows .exe — no publish
npm run package:mac   # Local macOS .dmg — no publish
npm run publish:win   # Build + publish Windows release to GitHub Releases
npm run publish:mac   # Build + publish macOS release to GitHub Releases
npm run publish:all   # Both platforms sequentially
```

`publish:*` requires `GH_TOKEN` with repo write permission.

> **No test or lint scripts exist** in this project.

## Architecture

Electron app with strict main/renderer separation:

```
src/
├── main/               Node.js process
│   ├── index.ts        App bootstrap, BrowserWindow, IPC handlers (setupIPC)
│   ├── scheduler.ts    In-memory AppState, polling loop, MR sync logic
│   ├── store.ts        electron-store persistence; token encrypted via safeStorage
│   ├── tray.ts         System tray icon + context menu
│   ├── notifier.ts     Desktop notifications
│   ├── webhook.ts      Local HTTP server for GitLab webhook events
│   ├── tunnel.ts       Optional Cloudflare tunnel exposure
│   ├── socket-client.ts Optional Socket.IO relay client (reverse proxy mode)
│   ├── updater.ts      electron-updater auto-update
│   └── single-instance.ts Lock file to prevent duplicate app instances
├── preload.ts          contextBridge — the only bridge between main and renderer
├── renderer/           React (Vite, ESNext, noEmit)
│   ├── App.tsx         Root component + page routing
│   ├── pages/          Dashboard, Settings, TeamReport, Changelog
│   ├── components/     MRCard, etc.
│   └── electron.d.ts   TypeScript types for window.electronAPI
└── shared/             Imported by both sides
    ├── types.ts        All shared interfaces (Settings, AppState, MergeRequest, IpcChannel…)
    └── gitlab.ts       GitLab REST API v4 client (axios, PRIVATE-TOKEN header)
```

## Key Conventions

### IPC — 3-file checklist
Every new IPC channel requires changes in **exactly 3 files**:
1. `src/preload.ts` — expose via `contextBridge.exposeInMainWorld`
2. `src/main/index.ts` `setupIPC()` — register `ipcMain.handle`
3. `src/renderer/electron.d.ts` — add TypeScript type to `Window.electronAPI`

All channel names are typed in `IpcChannel` in `src/shared/types.ts` — add new channels there too.

### Two TypeScript configs
- **`tsconfig.json`** — renderer: ESNext modules, `noEmit`, bundled by Vite
- **`tsconfig.main.json`** — main process: CommonJS, emits to `dist/`
- Both share `src/shared/`

### State flow
`scheduler.ts` owns the single in-memory `AppState`. On change it fires `onStateChange` (set by `index.ts`), which pushes the new state to the renderer via `mainWindow.webContents.send('app-state-updated', state)`. The renderer also calls `get-app-state` once on mount.

### Two sync modes (mutually exclusive)
- **Polling** — `scheduler.ts` runs `syncNow()` on an interval
- **Webhook** — `webhook.ts` runs a local HTTP server; optionally exposed via Cloudflare tunnel (`tunnel.ts`) or a Socket.IO relay (`socket-client.ts`)

### Token storage
`store.ts` encrypts the access token with `safeStorage` (OS keychain-backed) before writing to `electron-store`. The plain token is **never** persisted to disk — only the base64-encoded encrypted buffer is stored under `encryptedToken`.

### nativeImage in packaged builds
`nativeImage.createFromPath()` cannot read from `.asar` archives. Always use:
```ts
nativeImage.createFromBuffer(fs.readFileSync(path))
```

### Versioning & changelog
Every code change must bump `version` in `package.json` **and** add a corresponding entry to `CHANGELOG.md`. The CI workflow extracts release notes from `CHANGELOG.md` by matching the version block.

### electron-builder config
Packaging config lives entirely in the `"build"` field of `package.json`. The file `electron-builder.config.ts` is **not used** by any npm script.

### Windows cross-compilation (Apple Silicon)
Always pass `--arch x64` explicitly for Windows builds. Without it, electron-builder defaults to host arch (arm64).

### Single-instance cleanup
Use `cleanupSingleInstanceChannelSync()` (sync) in the `before-quit` event, not the async version — the async version won't complete before the process exits.

### GitLab webhook ownership
`gitlab.ts` identifies app-owned webhooks with a description prefix `gitlab-mr-manager:<username>` for safe upsert/cleanup per project.
