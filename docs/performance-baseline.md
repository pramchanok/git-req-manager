# Electron performance baseline — 2026-09-19

Measured the actual Electron application using compiled production main, preload, and renderer code. This is an unpackaged local baseline with deterministic GitLab fixtures, not a browser-only test, packaged-release benchmark, or live GitLab latency measurement. No before/after speedup is claimed.

## Environment and workload

- Windows 11 build 26200, Intel Core Ultra 9 275HX, 24 logical CPUs, 63.4 GiB RAM.
- Electron 43.0.0, Chromium 150.0.7871.46, Electron Node 24.17.0; Playwright 1.62.1 drives real BrowserWindows.
- 50 review MRs, 200 open MRs; each MR has 20 diff files and 10 discussion threads. Fixture requests wait 12 ms and pass through the real GitLab client, pagination, scheduler, IPC and preload.
- Warm OS/filesystem caches, fresh isolated user profiles for startup runs. Real splash lifecycle is included. Auto-updater follows its normal unpackaged disabled path; no real update check.
- Steady-phase figures below use a 3-second settling period followed by a 5-second sample. The baseline records idle windows after data/editor load; it does not measure scrolling, typing, large diff rendering or sustained interaction.

## Results

Startup means process launch through a visible dashboard with both **My Reviews 50** and **All Open 200** rendered. Three initial launches took **1,465 / 1,486 / 1,482 ms** (median **1,482 ms**). Subsequent launches ranged 1,488–1,570 ms. These include automation overhead and are not cold-boot numbers.

MR usable means the real `openMRWindow` IPC request through a mounted Markdown toolbar and enabled comment textarea. In the complete run, the three MR windows took **936 / 919 / 928 ms** (median **928 ms**). The Markdown editor is enabled by default; these timings include loading it.

| Phase | Electron processes | CPU, % of one core | Summed working set, MiB | Summed private bytes, MiB |
| --- | ---: | ---: | ---: | ---: |
| Dashboard visible | 4 | 0.17 | 486.0 | 267.2 |
| Dashboard + 1 MR | 5 | 0.64 | 679.5 | 388.4 |
| Dashboard + 3 MRs | 7 | 0.73 | 997.1 | 562.6 |
| All 4 windows hidden to tray | 7 | 4.61 | 954.6 | 517.2 |

CPU is the sum of process cumulative CPU-seconds deltas divided by elapsed wall-seconds, multiplied by 100. It is **one-core equivalent**, not Windows Task Manager's machine-normalized percentage: 4.61% of one core is approximately 0.19% across 24 logical CPUs. Working-set sums can count shared pages more than once; do not interpret them as unique physical RAM. Private bytes are reported separately from Electron's Windows process metrics.

All four sample windows recorded zero fixture API requests **during the sampled five seconds**. This does not establish a long-term polling rate. Hidden windows remain resident; hiding is not unloading. The hidden sample still included CPU work (GPU 2.55%, one MR renderer 1.95% of one core), so it is not evidence of zero idle CPU.

Two earlier measurement passes used only 1.2 seconds of settling and stopped after three-window metrics because of an automation selector mismatch in the emoji picker. Their dashboard samples ranged from **0.17% to 29.42%** of one core. This variance is retained here; a five-second sample is too short to establish a CPU ceiling or a long-term average. The final complete run used three seconds of settling. Memory also varied across launches.

## What the baseline suggests

1. Window count is the clearest memory driver: one MR added about **121 MiB private bytes**; three added about **295 MiB** over the dashboard in the complete run. Reuse an already-open MR window and consider unloading long-hidden windows only with reliable draft/view-state restoration.
2. The Markdown editor loads on every MR because it is enabled by default as requested. Rendering the full editor only while the Overview tab is active, and preserving its state when unmounted, is a possible next experiment; benchmark it before claiming a benefit.
3. Measure 30–60 seconds of steady idle and active review workloads for decisions about CPU. This run measures a small, repeatable baseline rather than sustained usage or a memory leak.

## UI verification in the actual Electron app

- Markdown toolbar was present on initial MR load.
- The emoji control displayed a smile icon with the accessible name `Insert emoji`.
- Clicking the icon opened the real emoji picker; clicking a visible grinning emoji inserted `😀` into the draft.
- No comments, approvals, merges or other GitLab mutations were submitted.

Complete results and native-window screenshots from this run:

- [Raw process snapshots and timings](../output/performance/2026-09-19T07-12-15-507Z/results.json)
- [Default Markdown editor and smile icon](../output/performance/2026-09-19T07-12-15-507Z/mr-default-markdown.png)
- [Open emoji picker](../output/performance/2026-09-19T07-12-15-507Z/mr-smile-picker.png)
- [Initial three-startup sample](../output/performance/2026-09-19T07-09-51-556Z/results.json)

These artifacts are local generated output, not required source files for the harness.

## Reproduce

Run from the repository root after building:

```powershell
npm run build
node scripts/profile-electron.cjs
```

If Node's mise shim is unavailable, call the installed Node executable directly. Set `PLAYWRIGHT_RUNTIME` to an existing Playwright package directory if it is not at the bundled Codex runtime location; this harness installs nothing. Optional settings:

```powershell
$env:MR_PERF_SAMPLE_MS = '10000' # default 5000; supported 5000–30000
$env:MR_PERF_STARTUP_RUNS = '3' # default 3; supported 1–3
node scripts/profile-electron.cjs
```

The driver launches `node_modules/electron/dist/electron.exe`, so this entry point targets Windows. It writes a timestamped directory under `output/performance`, including fresh profiles, raw metrics and screenshots. `profile-electron-main.cjs` sets the isolated `userData` before loading the actual compiled app. It supplies a fake token/host, blocks external Chromium requests and other Node HTTP transports, and handles only read-only fixture `fetch` calls. The harness alone disables login-item writes, native notification display and the installed app's fixed singleton lock/channel. Product code, context isolation, preload, client and scheduler stay intact.

Inside the restricted shell, Electron renderer/GPU children crashed with `0xC0000135`, followed by a Playwright protocol assertion. The identical isolated harness succeeded outside that sandbox. No dependency reinstall, GPU flag, or product-security change was used. Run in a native terminal or an authorized environment that permits Electron child processes.

The successful harness closes its application in `finally`; after these runs, no workspace Electron processes remained. If a future launch fails before Playwright returns the application handle, inspect the exact harness process command line before terminating any survivor. Never terminate unrelated Electron applications.
