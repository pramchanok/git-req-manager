---
name: electron-feature-development
description: Implement and modify Electron features in GitLab MR Manager across main, preload, shared, and React renderer boundaries. Use for new IPC operations, BrowserWindow behavior, renderer-to-main capabilities, shared application state, tray integration, or features that touch more than one Electron process.
---

# Electron Feature Development

## Workflow

1. Read `docs/project-architecture.md` and inspect the current call path.
2. Keep OS, filesystem, credentials, GitLab mutations, windows, notifications, and updater logic in `src/main/`.
3. Keep UI state and interaction in `src/renderer/`; keep serializable contracts in `src/shared/types.ts`.
4. Reuse existing services and implement the smallest complete vertical slice.
5. Preserve context isolation; never expose `ipcRenderer`, Node primitives, or a generic invoke method.

## IPC checklist

Update all three integration points: `src/main/index.ts` (`ipcMain.handle`), `src/preload.ts` (`contextBridge` method), and `src/renderer/electron.d.ts` (matching type). Align channel names, arguments, return types, nullability, and errors. Validate untrusted inputs in main.

## State and lifecycle

- Treat `src/main/scheduler.ts` as the owner of `AppState`.
- Push updates through the existing callback and `app-state-updated` event.
- Reset identity caches when GitLab URL or token changes.
- Clean up listeners, timers, windows, sockets, and callbacks.
- Follow existing window helpers in `src/main/index.ts`.
- Load packaged images through buffers, not `nativeImage.createFromPath()`.
- Preserve synchronous single-instance cleanup in `before-quit`.

## Verification

Run focused tests, then `npm run build` to compile both TypeScript configurations. Full dev mode must run from a native terminal rather than another Electron process.
