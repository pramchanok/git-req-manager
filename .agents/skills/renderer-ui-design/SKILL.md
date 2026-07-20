---
name: renderer-ui-design
description: Design, implement, or refine the React renderer interface of GitLab MR Manager. Use for pages, components, MR cards/details, settings, reports, loading or empty states, responsive Electron layouts, styling, badges, icons, animation, accessibility, or visual consistency.
---

# Renderer UI Design

## Workflow

1. Inspect `src/renderer/App.tsx`, `src/renderer/index.css`, and nearby components.
2. Reuse established tokens, components, and interaction patterns.
3. Keep data access behind `window.electronAPI`; never import Node or main-process modules.
4. Implement loading, refreshing, empty, success, partial failure, error, disabled, and destructive-action states as applicable.
5. Verify realistic Electron window sizes.

## Visual rules

- Maintain a premium developer-tool aesthetic with controlled accents, subtle shadows, glass effects, and purposeful motion.
- Prioritize hierarchy and scannability.
- Use existing Lucide icons and respect reduced motion.
- Move project names, branches, labels, and status badges into metadata rows when title wrapping is possible.
- Use `rounded-md`, restrained colors, subtle shadows, and related icons for badges.
- Keep full truncated values discoverable.

Keep page orchestration in `pages/` and reusable UI in `components/`. Preserve keyboard navigation, visible focus, semantic controls, accessible labels, contrast, and confirmation for destructive MR actions.

## Verification

Run `npm run build`. Inspect overflow, wrapping, hover/focus, disabled and empty states, and long GitLab content. Run full dev mode from a native terminal.
