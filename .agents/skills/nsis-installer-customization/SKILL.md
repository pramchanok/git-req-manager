---
name: nsis-installer-customization
description: Modify, debug, generate assets for, or verify the custom Windows NSIS installer used by GitLab MR Manager. Use for assets/installer.nsh, installer splash UI, InstFiles pages, progress bars, NSIS controls, BMP generation, install launch behavior, or Windows packaging failures.
---

# NSIS Installer Customization

Read `assets/installer.nsh`, `scripts/generate-splash.ps1`, and the `nsis` configuration in `package.json` first.

## Architecture

- Preserve `oneClick: false` for custom page hooks.
- Use `customInstallMode` with `$isForceCurrentInstall = "1"` to skip installation options.
- Use `customPageAfterChangeDir` with InstFiles show/leave hooks.
- Wrap install-only functions in `!ifndef BUILD_UNINSTALLER`.

The inner `#32770` dialog has only control 1004 (progress), 1006 (static text), and 1016 (details). Never target nonexistent IDs such as 1027 or 1028.

## Visual constraints

- Do not overlay persistent text with `CreateWindowEx`; bake it into `assets/splash.bmp` using `scripts/generate-splash.ps1`.
- Use BMP and `${BUILD_RESOURCES_DIR}`.
- Never reparent the progress bar or hide its inner dialog.
- Preserve the existing flat-theme pattern.
- Supply progress colors in BGR, not RGB.

Launch `"$INSTDIR\GitLab MR Manager.exe"` without `--first-run` from the leave hook.

## Verification

Regenerate the bitmap when needed, then run `npm run package:win`. Separately verify actual Windows UI: progress moves, text persists, completion launches correctly, and uninstaller generation adds no warnings.
