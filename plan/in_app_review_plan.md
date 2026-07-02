# Goal Description

Enable users to review code, read/write comments, approve, and merge Merge Requests directly within the GitLab MR Manager app without having to open a web browser.

## User Review Required

> [!IMPORTANT]
> To implement the diff viewer, we will need to decide whether to build a custom lightweight diff viewer or install an external dependency like `react-diff-viewer-continued`. Since this is a Vite + React project, installing a library would be faster, but building a custom one keeps the bundle size smaller. I recommend using a library for a better out-of-the-box experience.

> [!WARNING]
> Fetching large diffs for massive MRs might impact performance. We'll need to handle loading states carefully and potentially limit the size of diffs shown inline.

## Open Questions

> [!IMPORTANT]
> 1. Do you want to support replying to specific inline comments (threads on lines of code), or is it enough to just read all discussions and add general comments to the MR for now?
> 2. Should we add a confirmation dialog before Merging/Closing an MR to prevent accidental clicks?

## Proposed Changes

### Shared Types & API Client

#### src/shared/types.ts
- Add new interfaces: `MRDiff`, `MRNote`, `MRDiscussion`.
- Update `IpcChannel` union type with new channels.

#### src/shared/gitlab.ts
- Add methods to `GitLabClient`:
  - `getMRDiffs(projectId: number, mrIid: number)` using `GET /projects/:id/merge_requests/:iid/changes`
  - `getMRDiscussions(projectId: number, mrIid: number)` using `GET /projects/:id/merge_requests/:iid/discussions`
  - `addMRNote(projectId: number, mrIid: number, body: string)`
  - `approveMR(projectId: number, mrIid: number)`
  - `unapproveMR(projectId: number, mrIid: number)`
  - `mergeMR(projectId: number, mrIid: number)`
  - `closeMR(projectId: number, mrIid: number)`

---

### Main Process & Preload

#### src/main/index.ts
- Add `ipcMain.handle` listeners for all the new GitLab API methods. They will retrieve the `GitLabClient` instance and call the respective methods.

#### src/preload.ts
- Expose the new methods in `window.electronAPI` via `contextBridge`.

---

### Renderer (UI)

#### src/renderer/App.tsx
- Add a new page type: `type Page = ... | 'mr-detail'`.
- Add a state `selectedMR: MergeRequest | null`.
- When `page === 'mr-detail'`, render the new `<MRDetail mr={selectedMR} />` component.

#### src/renderer/components/MRCard.tsx
- Change the `onClick` handler from opening the web URL to calling `onSelect(mr)`.
- Pass the `onSelect` prop from `Dashboard.tsx` to set `selectedMR` and change the page to `'mr-detail'`.

#### src/renderer/pages/MRDetail.tsx
- Create a detailed view for a single MR.
- **Header**: Title, state (badge), source/target branches, author info.
- **Tabs**: 
  1. **Overview**: Shows the MR description (rendered as markdown if possible) and a list of discussions/comments. Includes a text area to add a new comment.
  2. **Changes**: Renders the file diffs.
- **Action Bar**: Fixed bottom or top bar with primary actions:
  - Approve (or Revoke Approval)
  - Merge (only if approved/ready)
  - Close MR
  - Open in Browser (fallback)
