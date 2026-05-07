# Performance Plan

วิเคราะห์จาก source code เมื่อ 2026-05-07

---

## ปัญหาที่พบ (เรียงตาม priority)

---

### 🔴 P1 — Pipeline API ยิงพร้อมกัน N calls / sync

**ไฟล์:** `src/main/scheduler.ts` line 60–62

```ts
// ปัจจุบัน: รอ allOpenMRs เสร็จก่อน แล้วค่อย fetch pipeline ทีเดียว N calls
const [reviewMRs, allOpenMRs] = await Promise.all([...])
const pipelineStatuses = await Promise.all(
  reviewMRs.map((mr) => client.getMRPipelines(mr.projectId, mr.iid))
)
```

**ปัญหา 2 ระดับ:**
1. Pipeline fetch รอ `allOpenMRs` โดยไม่จำเป็น — เริ่มได้ทันทีที่ `reviewMRs` มาถึง
2. ถ้า reviewMRs มี 30 MR → ยิง 30 API calls พร้อมกัน → เสี่ยง rate limit GitLab (default 2000 req/min แต่ burst อาจถูก throttle)

**แก้:**
```ts
// เริ่ม pipeline fetch ทันทีที่ reviewMRs พร้อม โดยไม่รอ allOpenMRs
const [reviewMRs, allOpenMRs] = await Promise.all([
  client.getMRsForReview(user.id).then(async (mrs) => {
    const statuses = await Promise.all(
      mrs.map((mr) => client.getMRPipelines(mr.projectId, mr.iid))
    )
    mrs.forEach((mr, i) => { mr.pipelineStatus = statuses[i] })
    return mrs
  }),
  client.getAllOpenMRs(settings.projectIds),
])
```

และเพิ่ม throttle: batch pipeline calls เป็น chunk ละ 5–10 แทน Promise.all ทีเดียว

---

### 🔴 P1 — `notifiedMRIds` ในStore ไม่เคย prune

**ไฟล์:** `src/main/store.ts` — `addNotifiedMRId()`

```ts
// ปัจจุบัน: อ่านทั้ง array → เขียนทั้ง array ทุกครั้ง + list โตไม่มีที่สิ้นสุด
export function addNotifiedMRId(id: number): void {
  const ids = store.get('notifiedMRIds', [])   // อ่าน disk
  if (!ids.includes(id)) {                      // O(n) scan
    store.set('notifiedMRIds', [...ids, id])    // เขียน disk
  }
}
```

**ปัญหา:**
- O(n) ทุก notification ยิ่งนานยิ่งช้า
- หลังใช้งาน 6 เดือน list อาจมี 1,000+ IDs ที่ MR นั้นปิดไปนานแล้ว
- เขียน disk ทุกครั้ง (electron-store เป็น synchronous JSON write)

**แก้:**
```ts
// cap ที่ 500 รายการล่าสุด + prune ตอน syncNow() ทุกครั้ง
export function pruneNotifiedMRIds(activeIds: Set<number>): void {
  // เก็บแค่ IDs ที่ยังเป็น open MR อยู่ (ป้องกัน list โต)
  const ids = store.get('notifiedMRIds', [])
  const pruned = ids.filter((id) => activeIds.has(id)).slice(-500)
  if (pruned.length !== ids.length) {
    store.set('notifiedMRIds', pruned)
  }
}
```
เรียก `pruneNotifiedMRIds` ใน `syncNow()` หลัง fetch เสร็จ

---

### 🟡 P2 — `getCurrentUser()` เรียกทุก sync ทั้งที่ user ไม่เปลี่ยน

**ไฟล์:** `src/main/scheduler.ts` line 51

```ts
const user = await client.getCurrentUser()  // 1 API call ทุก 5 นาที
```

**แก้:** cache ไว้ใน module-level variable, re-fetch เมื่อ settings เปลี่ยนหรือ user เป็น null

```ts
let cachedUser: GitLabUser | null = null

// ใน syncNow():
const user = cachedUser ?? (cachedUser = await client.getCurrentUser())

// ใน restartScheduler() (เรียกเมื่อ settings เปลี่ยน):
cachedUser = null
```

---

### 🟡 P2 — `getMRPipelines` ดึง pipeline ทั้งหมด ทั้งที่ต้องการแค่ index 0

**ไฟล์:** `src/shared/gitlab.ts` line 165

```ts
// ปัจจุบัน: ดึง pipeline ทุกตัวของ MR นั้น
await this.http.get(`/projects/${projectId}/merge_requests/${mrIid}/pipelines`)

// แก้: เพิ่ม per_page=1 เพื่อลด payload
await this.http.get(`/projects/${projectId}/merge_requests/${mrIid}/pipelines`, {
  params: { per_page: 1 }
})
```

---

### 🟡 P2 — TeamReport: `filtered` / `sorted` ไม่ได้ memoize

**ไฟล์:** `src/renderer/pages/TeamReport.tsx` line 65–63

```ts
// ปัจจุบัน: recalculate ทุก render รวมถึงตอน expand/collapse card
const filtered = search.trim() ? devSummaries.filter(...) : devSummaries
const sorted = [...filtered].sort(...)
```

**แก้:**
```ts
const filtered = useMemo(
  () => search.trim() ? devSummaries.filter(...) : devSummaries,
  [devSummaries, search]
)
const sorted = useMemo(
  () => [...filtered].sort(...),
  [filtered]
)
```

---

### 🟢 P3 — `allOpenMRs` ไม่มี pagination (hard cap 100)

**ไฟล์:** `src/shared/gitlab.ts` `getAllOpenMRs()`

ถ้า project มี >100 open MRs จะขาดข้อมูล — ต้องเพิ่ม while-loop pagination เหมือน `getAccessibleProjects()`

สำคัญสำหรับ team ใหญ่ แต่ใช้ effort สูงกว่า และต้องระวัง API call เพิ่มขึ้นมาก

---

## สรุปลำดับ

| # | ปัญหา | Impact | Effort |
|---|---|---|---|
| 1 | Pipeline parallelization + throttle | สูง | กลาง |
| 2 | Prune notifiedMRIds | กลาง (long-term) | ต่ำ |
| 3 | Cache currentUser | ต่ำ | ต่ำมาก |
| 4 | per_page=1 ใน getMRPipelines | ต่ำ | ต่ำมาก |
| 5 | Memoize filtered/sorted | ต่ำ | ต่ำมาก |
| 6 | allOpenMRs pagination | กลาง | สูง |

**แนะนำทำ #3 + #4 + #5 ก่อน** — effort ต่ำมาก ทำได้เร็ว
แล้วค่อยทำ #2 + #1 ต่อ
