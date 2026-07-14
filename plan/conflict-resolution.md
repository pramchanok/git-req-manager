# In-App Editor & Conflict Resolution Plan

## เป้าหมาย (Goal)
ยกระดับหน้ารีวิว Merge Request ให้สามารถ **"แก้ไขไฟล์ (Editor Mode)"** และ **"แก้โค้ดชน (Resolve Conflicts)"** ได้จากภายในตัวแอปพลิเคชันโดยตรง ผ่านความสามารถของ GitLab API

## แผนการพัฒนา (Proposed Changes)

### 1. GitLab API Integration (Backend)
เพิ่มฟังก์ชันใน `src/shared/gitlab.ts` และเชื่อมผ่าน IPC (`src/main/index.ts` / `src/preload.ts`):
- **`getMRConflicts(projectId, iid)`**: ดึงข้อมูลไฟล์ที่เกิด Conflict (`GET /projects/:id/merge_requests/:iid/conflicts`)
- **`resolveMRConflicts(projectId, iid, content)`**: ส่งข้อมูลที่แก้ไข Conflict แล้วกลับไปให้ GitLab (`POST /projects/:id/merge_requests/:iid/conflicts`)
- **`commitChanges(projectId, branch, commitMessage, actions)`**: สร้าง Commit ใหม่เพื่อบันทึกการแก้ไขใน Editor Mode (`POST /projects/:id/repository/commits`)

### 2. Editor Mode (UI)
- ติดตั้งไลบรารี `@monaco-editor/react` (ไลบรารีเดียวกับที่ VS Code ใช้) เพื่อให้แสดงผล Syntax Highlighting และพิมพ์โค้ดได้สมจริง
- เพิ่มปุ่ม **"✏️ Edit"** ที่แถบเครื่องมือของแต่ละไฟล์ในหน้า Changes
- เมื่อกด Edit หน้าดู Diff จะเปลี่ยนเป็น Text Editor ให้พิมพ์แก้ได้
- มีปุ่ม **"Commit Changes"** ภายใต้ Editor ให้กรอก Commit Message และส่งการแก้ไขไปยัง Branch ต้นทาง

### 3. Conflict Resolution Mode (UI)
- ถ้าระบบพบว่า MR มี `has_conflicts: true` จะแสดงปุ่ม **"⚠️ Resolve Conflicts"** ที่หน้า Overview
- เปิดหน้าต่าง/โหมดแก้ Conflict ซึ่งจะแสดง 2-Way Diff หรือ 3-Way Merge Editor
- มีปุ่มทางลัด `Use ours` หรือ `Use theirs` รวมถึงช่องตรงกลางให้เขียนโค้ดผสานได้ตามต้องการ
- กด **"Resolve and Commit"** เพื่อส่งข้อมูลกลับไปยัง GitLab API

### 4. Open Questions & Considerations
- **Bundle Size**: การใช้งาน Monaco Editor อาจทำให้แอปใหญ่ขึ้น 2-5 MB แต่แลกมากับประสบการณ์ใช้งานระดับเทพ (เทียบเท่า VS Code หรือ GitLab Web IDE)
- **Commit Scope**: โหมด Editor ทั่วไป ควรออกแบบให้เซฟทีละไฟล์ (Single-file) ก่อนเพื่อให้ UI เรียบง่าย 

## แผนการทดสอบ (Verification)
1. เพิ่ม Unit Tests ในส่วนของการเชื่อมต่อกับ Conflict API
2. ทดลองสร้าง Conflict ใน GitLab เพื่อดึงข้อมูลมาจำลองหน้าตา UI
3. ลองกด "Use Ours" / "Use Theirs" แล้วยืนยันว่า GitLab รับทราบการแก้ Conflict สำเร็จ
