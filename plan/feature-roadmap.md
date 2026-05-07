# Feature Roadmap: GitLab MR Manager

วิเคราะห์จาก source code เมื่อ 2026-05-07 — อ้างอิงไฟล์จริงทุก finding

---

## Phase 0: ข้อมูลพื้นฐานที่ยืนยันแล้ว

**Allowed APIs** (มีอยู่แล้วใน `src/shared/gitlab.ts`):
- `getMRsForReview(userId)`, `getAllOpenMRs(projectIds)`, `getCurrentUser()`
- ยังไม่มี: pipeline status, approvals detail, MR notes

**Data already fetched but not shown** (`src/shared/types.ts` vs `src/renderer/components/MRCard.tsx`):
- `approvalsRequired`, `approvalsLeft`, `assignees[]`, `reviewers[]`, `updatedAt`, `downvotes`

---

## Phase 1 — Quick Wins (ข้อมูลมีแล้ว แค่ไม่แสดง)

ไม่ต้องแก้ API หรือ types — แค่แก้ `MRCard.tsx` และ `notifier.ts`

### 1.1 แสดง Approvals status บน MRCard
- ไฟล์: `src/renderer/components/MRCard.tsx`
- เพิ่ม badge เช่น `✓ 1/2` โดยใช้ `mr.approvalsLeft` และ `mr.approvalsRequired` (line 66–76 เป็น reference ของ badge pattern)
- สีเขียวเมื่อ `approvalsLeft === 0`, สีเหลืองเมื่อยังรออยู่

### 1.2 แสดง Reviewers / Assignees avatars
- ใช้ `mr.reviewers` และ `mr.assignees` แสดง avatar stack (เหมือน GitLab UI)
- `mr.author.avatarUrl` ที่ line 27–34 เป็น pattern ให้ copy

### 1.3 แสดง `updatedAt` แทน/เพิ่มจาก `createdAt`
- แสดง "updated X ago" ถ้า `updatedAt !== createdAt`

### 1.4 แสดง downvotes
- ใช้ pattern เดิมที่ line 74–76 (`upvotes`)

**Verification:** grep `approvalsLeft` ใน MRCard.tsx ต้องพบ; build ผ่าน TypeScript strict

---

## Phase 2 — CI/Pipeline Status (ต้องเพิ่ม API)

### 2.1 เพิ่ม `pipelineStatus` ใน type
- ไฟล์: `src/shared/types.ts`
- เพิ่ม field: `pipelineStatus: 'running' | 'success' | 'failed' | 'canceled' | null`

### 2.2 เพิ่ม API method
- ไฟล์: `src/shared/gitlab.ts`
- เพิ่ม `getMRPipelines(projectId, mrIid)` → `GET /projects/:id/merge_requests/:iid/pipelines`
- ดึงเฉพาะ pipeline ล่าสุด (index 0)

### 2.3 Fetch pipeline ระหว่าง sync
- ไฟล์: `src/main/scheduler.ts` (function `syncNow()` line ~40)
- หลัง fetch MRs แล้ว ทำ `Promise.all` เพิ่ม pipeline fetch สำหรับ MRs ที่ต้องการ (เฉพาะ `myReviewMRs` ก่อน เพื่อ limit API calls)

### 2.4 แสดงใน MRCard
- badge: 🟢 / 🔴 / 🟡 ตาม pipeline status

**Verification:** ดู network call ใน DevTools (`win.webContents.openDevTools`) ต้องเห็น `/pipelines` endpoint

---

## Phase 3 — Richer Notifications

### 3.1 แก้ body notification ให้ถูกต้อง
- ไฟล์: `src/main/notifier.ts` line 16
- เปลี่ยน hardcode `"opened"` → ใช้ action type จาก webhook payload หรือ detect จาก state

### 3.2 Notification เมื่อ CI fail
- ใน `syncNow()` เปรียบเทียบ pipeline status ก่อน/หลัง sync
- ถ้า MR ที่คุณเป็น reviewer เปลี่ยนจาก `running` → `failed` ให้ notify

### 3.3 Fix re-notification หลัง restart
- ไฟล์: `src/main/notifier.ts`
- Persist `notifiedMRIds` ผ่าน `electron-store` (ใช้ pattern เดียวกับ `store.ts`)

**Verification:** restart app → MR ที่มีอยู่แล้วต้องไม่ re-notify

---

## Phase 4 — Tray UX

### 4.1 เพิ่ม "Settings" ใน tray menu
- ไฟล์: `src/main/tray.ts` line 71–96
- เพิ่ม menu item ส่ง IPC `show-settings` ให้ renderer switch ไป Settings page

### 4.2 Window position ใกล้ tray icon
- แทนที่ `win.center()` (line 106–109) ด้วย position calculation จาก `tray.getBounds()`
- ตาม platform: macOS วางใต้ tray bar, Windows วางเหนือ taskbar

### 4.3 Quick-open MR จาก tray (Top 3 MRs)
- เพิ่ม submenu "My Reviews" ใน tray ที่แสดง MR title 3 อันดับแรก
- คลิกแล้ว `shell.openExternal(mr.webUrl)`

**Verification:** คลิก tray icon ต้องขึ้นใกล้ icon ไม่ใช่กลางจอ

---

## Phase 5 — Verification & Polish

```bash
# TypeScript clean build
npm run build

# ตรวจ anti-patterns
grep -n "mr\.approvalsLeft\|mr\.reviewers\|pipelineStatus" src/renderer/components/MRCard.tsx
grep -n "notifiedMRIds" src/main/notifier.ts  # ต้องมี store.set

# Dev mode test
npm run dev  # run from iTerm not Claude Code
```

---

## สรุปลำดับความสำคัญ

| Phase | Impact | Effort | ไม่ต้องแก้ API? |
|---|---|---|---|
| 1 — Approvals + Reviewers | สูงมาก | ต่ำ | ✅ |
| 2 — CI Status | สูง | กลาง | ❌ (เพิ่ม 1 method) |
| 3 — Better Notifications | กลาง | ต่ำ | ✅ |
| 4 — Tray UX | กลาง | กลาง | ✅ |

**แนะนำเริ่มจาก Phase 1** — ข้อมูลมีอยู่แล้วทุกอย่าง แค่ render ให้ถูกที่ ได้ value ทันทีโดยไม่เพิ่ม API calls
