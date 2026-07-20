---
name: release-and-packaging
description: Prepare, build, package, publish, or diagnose releases of GitLab MR Manager for Windows, macOS, or Linux. Use for version changes, electron-builder configuration, GitHub Releases, auto-update artifacts, signing, notarization, release workflows, package scripts, or release verification.
---

# Release and Packaging

## Safety gate

Before running `npm version` or changing `package.json` version, ask whether the current version has already been released. A request to build or publish does not imply version-bump permission. Confirm platform/version before publishing and never print token values.

## Preflight

1. Inspect scripts and the `build` field in `package.json`; this project does not use `electron-builder.config.ts`.
2. Inspect relevant CI workflows, `CHANGELOG.md`, and repository status.
3. Preserve unrelated changes.
4. Run `npm test` and `npm run build` before packaging.
5. Confirm platform, architecture, signing identity, and expected artifacts.

## Platform requirements

- Windows: use NSIS for updates and explicit x64 when cross-compiling from Apple Silicon.
- macOS: produce DMG and ZIP, require signing, and preserve hardened runtime, entitlements, and notarization.
- Linux: verify configured AppImage and DEB outputs.
- Keep GitHub `releaseType` as `draft` for sequential multi-platform uploads; finalize only after all required assets succeed.
- Confirm updater metadata accompanies installers and archives.

## Handoff

Report commands, platform/architecture, output paths, signing/notarization status, and unverified artifacts. Never claim install or auto-update success from compile-only checks.
