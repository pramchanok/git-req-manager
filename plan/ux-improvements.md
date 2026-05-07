# UX/UI Improvement Plan (2026)

Overall assessment: the app is functional and readable in dark mode,
but several patterns are outdated or missing by 2026 standards.
Below are grouped findings ordered by impact.

---

## P1 — High impact (visible, low-effort wins)

### 1. Fix `hover:bg-gray-750` no-op bug
`gray-750` is not a standard Tailwind color and is not defined in
`tailwind.config.js` → the hover background on `MRCard` is silently
broken (no hover feedback).
- **Fix**: Replace `hover:bg-gray-750` with `hover:bg-gray-700/50`
  and update any other `gray-750`/`gray-850` occurrences.

### 2. Replace emoji CI status circles with CSS badges
`🟢 CI`, `🔴 CI`, `🟡 CI` render as platform fonts — pixelated on
Windows, different sizes on macOS. A CSS colored dot is sharper and
consistent.
- **Fix**: `<span class="inline-block w-2 h-2 rounded-full bg-green-400"/>` +
  small "CI" text label inside the badge.

### 3. Age-based urgency on MR timestamps
No visual cue for old MRs. Users can't spot stale items at a glance.
- **Fix**:
  - ≥ 3 days: timestamp text → `text-yellow-500`
  - ≥ 7 days: timestamp text → `text-red-400` + optional blinking dot
  - Helper: update `timeAgo()` in `MRCard.tsx` to return a color class.

### 4. Skeleton loading states
Currently shows plain `Loading…` text; skeleton looks more modern and
reduces perceived wait time.
- **Fix**: Add a `<SkeletonCard />` component (3–4 shimmer rows) used
  in `Dashboard` and `TeamReport` while `isSyncing && length === 0`.

### 5. Navigation: add a proper nav bar
Three emoji buttons hidden in the title bar are not discoverable. A
labeled bottom or left sidebar nav is standard in 2026 desktop apps.
- **Fix**: Add a mini icon-tab bar (24 px wide sidebar or a small
  bottom strip) with icons + active state for Dashboard / Team / Settings.
  Keep title bar drag region intact.

---

## P2 — Medium impact (polish)

### 6. Hover elevation on MRCard
`hover:bg-gray-700/50` alone is flat. Adding a subtle left-border
accent on hover makes the card feel interactive.
- **Fix**: `hover:border-l-2 hover:border-orange-400 hover:pl-[10px]`
  (compensate padding to avoid layout shift).

### 7. Toast / snackbar feedback
No confirmation after "Settings saved" or "URL copied". Users don't
know if the action succeeded.
- **Fix**: A small `Toast` component (bottom-right, auto-dismiss 2 s)
  triggered by:
  - Settings save success
  - Clipboard copy (already has `copied` state but shows it inline)
  - Sync error

### 8. Page transition animation
Pages snap in/out instantly. A 150 ms fade is enough to feel modern.
- **Fix**: Wrap page content in a `<Fade key={page}>` component using
  `opacity` CSS transition. Tailwind's `animate-in` / `fade-in` (v3.3+).

### 9. Draft MR pill badge
`Draft` is just inline yellow text in the title. It's easily missed.
- **Fix**: Render it as a proper rounded badge:
  `<span class="bg-yellow-900/60 text-yellow-400 text-[10px] font-medium
  px-1.5 py-0.5 rounded-full mr-1">Draft</span>`

### 10. Consistent secondary text hierarchy
Three different grays (`text-gray-400/500/600`) used interchangeably
for secondary content. No clear scale.
- **Fix**: Establish a 3-tier convention and document it:
  - Primary text: `text-gray-100`
  - Secondary: `text-gray-400`
  - Tertiary / disabled: `text-gray-600`
  Audit all components and align.

---

## P3 — Nice to have

### 11. Empty state illustrations
"No MRs waiting for your review" is a single line of text. A small
inline SVG illustration makes empty states feel intentional.
- Small: a 48 px icon + headline + description pattern.

### 12. Keyboard shortcuts
Power users expect keyboard access.
- `Cmd/Ctrl+R` → trigger sync
- `Cmd/Ctrl+,` → open settings
- `Escape` → back to dashboard (from settings/team)
- **Fix**: `useEffect` keydown listener in `App.tsx`.

### 13. TeamReport: "last activity" label on dev card
Currently shows only MR counts. Showing how long ago the developer
last pushed (or merged) gives the team lead useful context.
- This requires an additional API call or inferring from MR `updated_at`.

### 14. Scrollbar: hide until hover
The 4 px scrollbar is already slim but always visible. Modern apps
hide it until the user hovers the container.
- **Fix**: Add `overflow-y-auto scrollbar-thin scrollbar-thumb-transparent
  hover:scrollbar-thumb-slate-600` (with tailwind-scrollbar plugin), or
  add CSS `opacity: 0 → 1` transition on `:hover`.

---

## Summary table

| # | Area | Impact | Effort |
|---|------|--------|--------|
| 1 | Fix gray-750 hover bug | 🔴 Bug | XS |
| 2 | CSS CI badge | 🟡 Visual | XS |
| 3 | Age urgency on timestamp | 🟠 UX | S |
| 4 | Skeleton loading | 🟠 UX | M |
| 5 | Nav bar | 🟠 Discoverability | M |
| 6 | Card hover border | 🟡 Polish | XS |
| 7 | Toast notifications | 🟡 Feedback | S |
| 8 | Page transitions | 🟡 Polish | S |
| 9 | Draft pill badge | 🟡 Visual | XS |
| 10 | Text color scale | 🟡 Consistency | S |
| 11 | Empty state art | 🟢 Nice | M |
| 12 | Keyboard shortcuts | 🟢 Power users | S |
| 13 | Dev last-activity | 🟢 Info | M |
| 14 | Scrollbar on hover | 🟢 Polish | XS |
