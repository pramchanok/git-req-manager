# Plan: Team Activity Report

ฉันเป็น lead team ต้องการ report สรุปว่า Dev ทุกคนทำงานอะไรบ้าง สามารถ filter ดูได้

วิเคราะห์จาก source code เมื่อ 2026-05-07

---

## Phase 0: ข้อมูลที่ยืนยันแล้ว

**Allowed APIs** (มีอยู่แล้วใน `src/shared/gitlab.ts`):
- `getAllOpenMRs(projectIds)` → คืน `MergeRequest[]` ทุกตัวพร้อม `author`, `assignees`, `reviewers`

**Data source สำหรับ team report:**
- `appState.allOpenMRs` (passed จาก `src/renderer/App.tsx` line 88) มีทุก field ที่ต้องการ

**Key insight:** Phase 1–3 ไม่ต้องเพิ่ม API ใหม่เลย — ใช้ข้อมูลที่ fetch อยู่แล้ว

**Copy-ready patterns:**
- Navigation toggle: `App.tsx` line 9 (`useState<Page>`) + line 66 (toggle button)
- Tab component: `Dashboard.tsx` lines 85–117 (`TabButton`)
- IPC handler pattern: `index.ts` line 251–307 (`ipcMain.handle('channel', fn)`)
- 3 ที่ต้องแก้ทุกครั้งที่เพิ่ม IPC: `preload.ts` + `index.ts setupIPC()` + `electron.d.ts`

---

## Phase 1 — เพิ่ม Page "Team Report" ใน Navigation

**ไฟล์ที่แก้: `src/renderer/App.tsx`**

1. เพิ่ม `'team-report'` ใน Page type (line 6):
   ```ts
   type Page = 'dashboard' | 'settings' | 'team-report'
   ```

2. เพิ่มปุ่มนำทางใน header (copy pattern จาก toggle button line 66) — icon `👥` สำหรับ team report

3. Render `<TeamReport appState={appState} />` เมื่อ `page === 'team-report'`
   - Pass `appState` เหมือน Dashboard (line 88): `<TeamReport appState={appState} />`

**Anti-pattern:** อย่าสร้าง router ใหม่ — ใช้ `useState<Page>` เดิมที่มีอยู่

**Verification:** `grep "team-report" src/renderer/App.tsx` ต้องพบทั้ง type, condition, และ render

---

## Phase 2 — TeamReport Component (กลุ่ม MR ตาม Dev)

**สร้างไฟล์ใหม่: `src/renderer/pages/TeamReport.tsx`**

**Props:**
```ts
interface TeamReportProps {
  appState: AppState  // same pattern as Dashboard.tsx line 5–7
}
```

**Logic — group MRs by developer:**
```
devMap: Map<username, { user: GitLabUser, authoredMRs: MergeRequest[], reviewMRs: MergeRequest[] }>
```
- ดึง author จาก `mr.author` ทุก MR ใน `appState.allOpenMRs`
- ดึง reviewers จาก `mr.reviewers[]`
- รวม unique devs โดยใช้ `username` เป็น key

**UI ต่อ Dev Card:**
- Avatar + ชื่อ + username (copy pattern จาก `MRCard.tsx` line 27–34)
- Badge: `N authored` + `N reviewing`
- Expandable list of MRCard ต่อ dev (reuse `<MRCard>` component เดิม)

**Anti-pattern:** อย่า fetch ข้อมูลใหม่ในหน้านี้ — ใช้ `appState.allOpenMRs` เท่านั้น

**Verification:** build TypeScript ผ่าน; แต่ละ dev card แสดงจำนวน MR ถูกต้อง

---

## Phase 3 — Filter & Search

**แก้ไฟล์: `src/renderer/pages/TeamReport.tsx`**

### 3.1 Tab filter: Role
```ts
type RoleTab = 'author' | 'reviewer' | 'assignee'
const [activeRole, setActiveRole] = useState<RoleTab>('author')
```
- Copy `TabButton` pattern จาก `Dashboard.tsx` lines 85–117
- Tab "As Author" | "As Reviewer" | "As Assignee"

### 3.2 Search by dev name
```ts
const [search, setSearch] = useState('')
```
- Filter `devMap` ด้วย `user.name.toLowerCase().includes(search)` หรือ `user.username`
- Input style copy จาก `Settings.tsx` input className

### 3.3 Sort options
- Sort by: "Most MRs" | "Recently updated"
- ใช้ `mr.updatedAt` สำหรับ recently updated

**Verification:**
```bash
grep -n "activeRole\|search\|TabButton" src/renderer/pages/TeamReport.tsx
```

---

## Phase 4 — เพิ่ม Merged MRs (Historical View) — Optional

ต้องเพิ่ม API method ใหม่และ IPC channel

### 4.1 เพิ่ม API method ใน `src/shared/gitlab.ts`
```ts
getMRsByAuthor(authorUsername: string, state: 'opened' | 'merged' = 'merged'): Promise<MergeRequest[]>
// GET /merge_requests?author_username=X&state=merged&per_page=50
```

### 4.2 เพิ่ม IPC channel (3 ไฟล์)

| ไฟล์ | การแก้ |
|---|---|
| `src/preload.ts` | เพิ่ม `getMergedMRsByAuthor: (username) => ipcRenderer.invoke('get-merged-mrs-by-author', username)` |
| `src/main/index.ts` setupIPC() | เพิ่ม `ipcMain.handle('get-merged-mrs-by-author', async (_e, username) => {...})` |
| `src/renderer/electron.d.ts` | เพิ่ม type declaration |

### 4.3 เพิ่ม "History" tab ใน TeamReport
- tab ที่ 4: "Merged (30d)"
- Lazy load เฉพาะเมื่อ click เพื่อไม่กระทบ performance

**Anti-pattern:** อย่า call API นี้ใน background sync — เรียกเฉพาะเมื่อ user เปิด history tab

**Verification:** `grep 'get-merged-mrs-by-author' src/preload.ts src/main/index.ts` ต้องพบทั้ง 2 ไฟล์

---

## Phase 5 — Verification

```bash
# TypeScript build ต้องผ่าน
npm run build

# ตรวจ navigation ครบ
grep -n "team-report" src/renderer/App.tsx

# ตรวจ IPC bridge ครบ (ถ้าทำ Phase 4)
grep -n "get-merged-mrs-by-author" src/preload.ts src/main/index.ts src/renderer/electron.d.ts

# Dev mode test
npm run dev  # run from iTerm
```

---

## สรุปลำดับความสำคัญ

| Phase | Impact | Effort | ต้องเพิ่ม API? |
|---|---|---|---|
| 1 — Page navigation | ต่ำ (scaffold) | ต่ำมาก | ❌ |
| 2 — Group by dev + MR list | สูงมาก | กลาง | ❌ |
| 3 — Filter + Search + Sort | สูง | ต่ำ | ❌ |
| 4 — Merged MRs history | กลาง | กลาง | ✅ (1 method) |

**แนะนำเริ่ม Phase 2–3 ก่อน** — เห็น value ทันทีโดยไม่ต้องแตะ backend/IPC เลย
