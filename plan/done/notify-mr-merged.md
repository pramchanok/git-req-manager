# Plan: แจ้งเตือนเมื่อ MR ของเราถูก Merge

**Feature**: ระบบแจ้งเตือนสำหรับ **ผู้สร้าง MR (Author)** เมื่อ Merge Request ของตัวเองถูก merge โดยคนอื่น

---

## ภาพรวม (Overview)

ระบบปัจจุบันแจ้งเตือนเฉพาะ **ผู้ review** (reviewer) เท่านั้น เช่น เมื่อได้รับ MR ใหม่ที่ต้องรีวิว แต่ **ผู้ที่สร้าง MR (author)** จะไม่รู้เลยว่า MR ของตัวเองถูก merge แล้ว จนกว่าจะมาเปิดดูเอง

Feature นี้จะเพิ่มการแจ้งเตือน: **"✅ MR ของคุณถูก Merge แล้ว"** ให้กับเจ้าของ MR โดยอัตโนมัติ

---

## กลไกการทำงาน (How It Works)

### Polling Mode (ค่าเริ่มต้น)
ทุกรอบ `syncNow()` ใน `scheduler.ts` จะ:
1. ดึง MR ที่ **เราสร้าง** และยัง **open** อยู่จาก GitLab API (`author_id = currentUser.id, state = opened`)
2. เปรียบเทียบกับรอบก่อนหน้า (`previousAuthoredMRIds`) — ถ้า MR ที่เคยเห็นว่า open หายไป (ไม่อยู่ใน list opened อีกต่อไป) แสดงว่าถูก merge หรือ close แล้ว
3. ตรวจสอบยืนยัน: เรียก API เพื่อดู `state` จริงของ MR นั้น — ถ้าเป็น `merged` จึงยิงการแจ้งเตือน

### Webhook Mode (Real-time)
- GitLab ส่ง Webhook event `object_attributes.action = "merge"` มาที่ webhook server ของเราแล้ว
- ตอนนี้ `webhook.ts` แค่ trigger `syncNow()` โดยไม่ได้ดูรายละเอียด event
- จะปรับให้ parse payload ของ webhook และตรวจสอบว่า `author.id === currentUser.id` แล้วยิงการแจ้งเตือนได้ทันทีโดยไม่ต้องรอ sync

---

## Proposed Changes (การเปลี่ยนแปลงที่เสนอ)

### 1. ⚙️ Store (`src/main/store.ts`)
เพิ่มการ track MR ที่เคยแจ้งเตือน "merged" แล้ว (กัน notify ซ้ำ) โดยใช้ key แยกต่างหาก:
- เพิ่ม field `notifiedMergedMRIds: number[]` ใน `StoreSchema`
- เพิ่มฟังก์ชัน `getNotifiedMergedMRIds()`, `addNotifiedMergedMRId()`, `clearNotifiedMergedMRIds()`

### 2. 🔔 Notifier (`src/main/notifier.ts`)
เพิ่มฟังก์ชัน `notifyMRMerged(mr: MergeRequest): void`:
```ts
export function notifyMRMerged(mr: MergeRequest): void {
  if (!Notification.isSupported()) return
  const notification = new Notification({
    title: '✅ MR Merged!',
    body: `"${mr.title}" ถูก merge เข้า ${mr.targetBranch} แล้ว`,
    silent: false,
  })
  notification.on('click', () => shell.openExternal(mr.webUrl))
  notification.show()
}
```

### 3. 🔌 GitLab Client (`src/shared/gitlab.ts`)
เพิ่มฟังก์ชัน `getAuthoredOpenMRs(authorId: number)`:
```ts
async getAuthoredOpenMRs(authorId: number): Promise<MergeRequest[]> {
  const { data } = await this.http.get('/merge_requests', {
    params: {
      author_id: authorId,
      state: 'opened',
      per_page: 100,
      scope: 'all',
    },
  })
  return data.map(this.mapMR.bind(this))
}
```
และ `getMRById(projectId: number, mrIid: number)` เพื่อยืนยัน state ว่า merged หรือ closed

### 4. 🔄 Scheduler (`src/main/scheduler.ts`)
เพิ่ม state tracking สำหรับ authored MRs:
```ts
let previousAuthoredOpenMRIds = new Set<number>()
```

ใน `syncNow()` เพิ่มขั้นตอน:
1. Fetch `client.getAuthoredOpenMRs(user.id)` พร้อมกันใน `Promise.allSettled`
2. เปรียบเทียบ: MR ID ที่หายไปจาก `previousAuthoredOpenMRIds` → อาจถูก merge
3. สำหรับแต่ละ MR ที่หายไป → เรียก `client.getMRById()` เช็ค state
4. ถ้า `state === 'merged'` และยังไม่เคยแจ้งเตือน → เรียก `notifyMRMerged(mr)`

### 5. ⚡ Webhook (`src/main/webhook.ts`)
ปรับ `WebhookCallback` ให้รับ payload เพิ่มเติม:
```ts
type WebhookPayload = {
  mrId: number | null
  action: string | null      // 'open' | 'merge' | 'close' | 'update' | ...
  authorId: number | null    // author.id จาก object_attributes.author_id
  targetBranch: string | null
  mrTitle: string | null
  webUrl: string | null
}
type WebhookCallback = (payload: WebhookPayload) => void
```

ใน `index.ts` ที่รับ callback จาก webhook:
- ถ้า `action === 'merge'` และ `authorId === currentUser.id` → เรียก `notifyMRMerged()` ทันที (real-time ไม่รอ sync)

### 6. 🎛️ Settings UI (`src/renderer/pages/Settings.tsx`)
เพิ่ม toggle ใต้หัวข้อ Notifications:
```
🔔 แจ้งเตือนเมื่อ MR ของคุณถูก Merge
[toggle on/off]
```
บันทึก setting นี้ใน `Settings` type ชื่อ `notifyOnMyMRMerged: boolean` (default: `true`)

---

## Type Changes (`src/shared/types.ts`)

```ts
export interface Settings {
  // ... existing fields ...
  notifyOnMyMRMerged: boolean   // NEW — default true
}
```

---

## IPC Checklist

ไม่มี IPC ใหม่ที่จำเป็น เนื่องจาก `notifyOnMyMRMerged` จะถูก save/load ผ่าน `save-settings` / `get-settings` ที่มีอยู่แล้ว

---

## Edge Cases & Guard Rails

| Case | วิธีรับมือ |
|------|-----------|
| MR ถูก Close (ไม่ใช่ Merge) | เช็ค `state === 'merged'` ก่อน notify — ถ้า closed จะไม่แจ้งเตือน |
| แจ้งเตือนซ้ำหลัง restart | ใช้ `notifiedMergedMRIds` store บันทึก MR ID ที่แจ้งเตือนไปแล้ว |
| MR ถูก merge โดยตัวเอง | แจ้งเตือนปกติ (ยังมีประโยชน์ใน real-time webhook mode) |
| API error ตอน verify state | Skip notify สำหรับ MR นั้น ไม่ crash |
| Polling + Webhook ทั้งคู่ active | `notifiedMergedMRIds` กัน duplicate ได้ |

---

## Verification Plan

### Manual Testing
1. สร้าง MR บน GitLab → รอให้คนอื่น merge → ตรวจสอบว่าได้รับ notification `✅ MR Merged!`
2. ทดสอบ webhook mode: merge MR จาก GitLab UI → notification ต้องมาแบบ real-time (ไม่ต้องรอ polling)
3. ปิด setting `notifyOnMyMRMerged = false` → merge อีกครั้ง → ต้องไม่มี notification
4. ตรวจสอบ MR ที่ถูก close (ไม่ merge) → ต้องไม่มี notification

### Build Validation
```bash
npm run build
```

---

## Priority: P1 (สำคัญ)

เป็น Feature ที่มีผลต่อ workflow จริง ช่วยให้ developer ไม่ต้องคอย refresh GitLab เพื่อดูว่า MR ของตัวเองถูก merge แล้วหรือยัง
