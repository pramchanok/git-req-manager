# แผนการพัฒนาฟีเจอร์: รายงานสรุปผลงานทีม (Team Performance Report)

ฟีเจอร์นี้จะช่วยสร้างหน้ารายงานสรุปผลงานการทำ Merge Request ของสมาชิกในทีม โดยสามารถฟิลเตอร์ดูรายวัน รายสัปดาห์ หรือรายเดือนได้ และมีการจำกัดสิทธิ์การเข้าถึงให้เฉพาะ **GitLab Owner (ของกลุ่มนั้นๆ)** หรือ **GitLab Administrator** เท่านั้น

---

## 🎨 UI Mockup (ตัวอย่างหน้าจอรายงานสรุปผลงาน)

````carousel
![1. หน้าหลักรายงานสรุปของทีม (หน้าต่างหลัก)](C:/Users/Prem/.gemini/antigravity/brain/ed635033-8271-4224-8660-a87f8a8efa63/team_report_mockup_1782447416144.png)
<!-- slide -->
![2. หน้าต่างแสดงรายละเอียดงานขนาด 1000x700 (ดีไซน์ Modern 2026 สวยหรู สบายตา กราฟครบ)](C:/Users/Prem/.gemini/antigravity/brain/ed635033-8271-4224-8660-a87f8a8efa63/premium_2026_report_mockup_1782448351334.png)
````

---

## 🔒 1. การควบคุมสิทธิ์การเข้าถึง (Access Control & Permissions)

เพื่อให้เป็นไปตามเงื่อนไขที่กำหนด ("คนที่จะดูได้คือ Owner หรือ Admin GitLab"):
1. **ตรวจสอบความสิทธิ์การเป็น Admin**:
   - ดึงข้อมูลจาก API `/user` เพื่อเช็คค่า `is_admin`
   - นำมาบันทึกในโมเดล `GitLabUser` (เพิ่มฟิลด์ `isAdmin: boolean` ใน `types.ts`)
2. **ตรวจสอบสิทธิ์การเป็น Owner ของกลุ่ม**:
   - ใช้ API `/groups?min_access_level=50` (ค่า 50 ใน GitLab API หมายถึง Owner)
   - หากผู้ใช้เป็น Owner ของกลุ่มใด กลุ่มนั้นจะแสดงในตัวเลือกการดูรายงาน
3. **การจำกัดสิทธิ์หน้า UI**:
   - หากผู้ใช้ไม่ใช่ทั้ง Admin และไม่ได้เป็น Owner ของกลุ่มใดๆ เลย: ระบบจะแสดงหน้า **"Access Restricted"** เพื่อแจ้งเตือนพร้อมไอคอนรูปกุญแจล็อค (ไม่อนุญาตให้เข้าหน้ารายงาน)
   - หากเลือกกลุ่มที่ตนเองไม่ได้เป็น Owner (และไม่ใช่ Admin): ระบบจะไม่สามารถดึงข้อมูลรายงานของกลุ่มนั้นได้

---

## 📊 2. การคำนวณสรุปการทำงาน (Performance Summary & Timeframes)

ระบบจะอนุญาตให้ดึงรายงานตามระดับกลุ่ม (GitLab Group) โดยคำนวณผลงานจาก **Merge Requests** ในช่วงเวลาที่ระบุ:

### ตัวเลือกช่วงเวลา (Timeframe Choices)
- **รายวัน (Daily)**: สรุปข้อมูลภายในวันที่เลือก (00:00:00 - 23:59:59 เวลาเครื่องผู้ใช้)
- **รายสัปดาห์ (Weekly)**: สรุปข้อมูลในสัปดาห์ปัจจุบัน (เริ่มจากวันจันทร์ถึงปัจจุบัน หรือเลือกสัปดาห์ย้อนหลัง)
- **รายเดือน (Monthly)**: สรุปข้อมูลในเดือนปัจจุบัน (เริ่มตั้งแต่วันที่ 1 ถึงสิ้นเดือน หรือเดือนย้อนหลัง)

### แหล่งข้อมูลและการดึงข้อมูล (API & Aggregation)
1. ดึงสมาชิกทั้งหมดในกลุ่มผ่าน API `/groups/{groupId}/members/all` เพื่อให้แสดงชื่อนักพัฒนาทุกคน แม้จะไม่มีการเคลื่อนไหวใดๆ ในช่วงเวลานั้น
2. ดึงข้อมูล Merge Requests ในช่วงเวลานั้นผ่าน API `/groups/{groupId}/merge_requests?state=all&updated_after={startTime}`
3. นำข้อมูลมาประมวลผลจัดหมวดหมู่ตามแต่ละผู้ใช้งาน:
   - **MRs Created (สร้าง)**: MRs ที่มีวันสร้าง (`created_at`) อยู่ในช่วงเวลาที่เลือก
   - **MRs Merged (รวมโค้ดสำเร็จ)**: MRs ที่มีสถานะเป็น `merged` และถูก merge (`merged_at`) ในช่วงเวลาที่เลือก
   - **Review Activity (การมีส่วนร่วมตรวจโค้ด)**: นับจำนวน MRs ที่ผู้ใช้งานคนนั้นเป็นหนึ่งใน `reviewers` หรือ `assignees` ในช่วงเวลาดังกล่าว
   - **Average Time to Merge (ระยะเวลาเฉลี่ยในการปิดงาน)**: คำนวณความแตกต่างระหว่างเวลา `created_at` และ `merged_at` ของ MRs ที่ถูก merge ในช่วงเวลานั้น

---

## 🎨 3. การออกแบบส่วนติดต่อผู้ใช้ (UI/UX Design)

เพื่อความสวยงาม หรูหรา สไตล์พรีเมียม (Rich Aesthetics):
- **Dashboard Layout**: มีแผงสรุปสถิติระดับภาพรวมกลุ่ม (Total Created, Total Merged, Active Contributors)
- **Timeframe Selector Toolbar**: ปุ่มปรับสลับ "Daily / Weekly / Monthly" และปุ่มลูกศร (◀ ▶) สำหรับเลื่อนถอยหลัง-เดินหน้าตามช่วงเวลา พร้อมหน้าต่างเลือกวันที่
- **Performance Bar/Meter**: แสดงแถบกราฟความก้าวหน้าของงานแต่ละคนเทียบกับเพื่อนร่วมงานด้วยแถบสีไล่เฉด (Gradients) ในดีไซน์โมเดิร์น
- **Glassmorphic Grid Cards**: การ์ดแสดงผลงานแบบขอบมนใส สะท้อนความลึกและใช้โทนสีมืด (Sleek Dark Mode) สอดคล้องกับภาพลักษณ์ตัวแอปหลัก
- **[NEW] ปุ่มเปิดรายงานแยก (Detail Window Button)**: ปุ่มคลิกที่แถวของแต่ละบุคคลเพื่อ "เปิดหน้าจอสรุปงานแบบละเอียด" ขึ้นมาเป็นหน้าต่างใหญ่แยกเฉพาะตัว (800x600px)
- **[NEW] แผงปุ่มส่งออกข้อมูล (Export Panel)**: ปุ่มกดส่งออกรายงานของนักพัฒนาคนนั้นๆ เป็นไฟล์ Markdown (.md), PDF (.pdf), หรือ Excel (.csv) จากหน้าต่างขนาดใหญ่ได้ทันที

---

## 🛠️ 4. แผนงานการปรับเปลี่ยนโค้ด (Proposed Changes)

### 🔹 [Shared Layer]
1. **[types.ts](file:///d:/Dev/gitlab-req-manager/src/shared/types.ts)**:
   - อัปเดตอินเตอร์เฟส `GitLabUser` ให้มี `isAdmin?: boolean`
   - อัปเดต `IpcChannel` เพื่อประกาศชาเนลสำหรับการดึงข้อมูลรายงาน, การเปิดหน้าต่างใหม่ และสั่งดาวน์โหลด/ส่งออกไฟล์

2. **[gitlab.ts](file:///d:/Dev/gitlab-req-manager/src/shared/gitlab.ts)**:
   - ปรับฟังก์ชัน `mapUser` ให้รองรับการแปลงค่า `is_admin`
   - เพิ่มฟังก์ชัน `getGroupMRsInTimeframe(groupId, since, until)` เพื่อดึงข้อมูล MRs ในช่วงเวลาที่เจาะจง

### 🔹 [Main Process]
1. **[index.ts](file:///d:/Dev/gitlab-req-manager/src/main/index.ts)**:
   - เพิ่ม IPC handler สำหรับดึงรายงานสรุปผลงานระดับกลุ่มตามช่วงเวลา
   - **[NEW]** เพิ่มฟังก์ชันสร้าง BrowserWindow สำหรับ Report Detail Window ขนาดใหญ่ (800x600px, resizable: true, frame: true)
   - **[NEW]** เพิ่ม IPC handler รับคำสั่งสำหรับบันทึกไฟล์ (Save File Dialog):
     - **Markdown (.md)**: เขียนไฟล์ .md ลงดิสก์โดยตรง
     - **PDF (.pdf)**: เรียกฟังก์ชัน `printToPDF()` ของ Electron แล้วเขียน Buffer ลงดิสก์
     - **Excel (.csv)**: แปลงข้อมูลสรุปเป็นไฟล์ CSV (พร้อมเขียน UTF-8 BOM `\uFEFF` เพื่อรองรับภาษาไทยใน Microsoft Excel)

### 🔹 [Renderer Process]
1. **[TeamReport.tsx](file:///d:/Dev/gitlab-req-manager/src/renderer/pages/TeamReport.tsx)**:
   - เขียนใหม่ (Overhaul) ให้รองรับ:
     - ตัวคัดกรองช่วงเวลา (รายวัน / รายสัปดาห์ / รายเดือน) และควบคุมการเลื่อนวันที่
     - การตรวจสอบสิทธิ์การเป็น Admin หรือ Owner ในการแสดงเนื้อหาหน้า
     - แสดงกราฟแถบสรุปงาน (Progress bar) สวยงามไล่โทนสี
     - แสดงข้อมูลสถิติภาพรวมกลุ่ม (Overview Stats Cards)
     - เมนู Dropdown เลือกกลุ่มที่จะดู โดยจะจำกัดให้เลือกได้เฉพาะกลุ่มที่ผู้ใช้เป็น Owner หรือถ้าเป็น Admin จะเลือกได้ทั้งหมด
     - **[NEW]** ปุ่มสำหรับทริกเกอร์เปิดหน้าต่างสรุปแบบละเอียดแยกต่างหาก

2. **[NEW] [ReportDetail.tsx](file:///d:/Dev/gitlab-req-manager/src/renderer/pages/ReportDetail.tsx)**:
   - หน้าเพจแสดงผลรายงานสรุปตัวใหม่ สำหรับแสดงผลในหน้าต่างแยกส่วนตัว
   - **Markdown Renderer**: แปลงข้อมูลผลงานที่รวบรวมได้ให้อยู่ในรูป Markdown Template (อย่างเช่น หัวข้อรายงานผลงาน, สรุปตัวเลขงานสร้าง/งานรีวิว, ลิงก์ไปยัง MR ต่างๆ พร้อมสถานะ) และ Render ให้เห็นแบบสวยงามบนหน้าต่างใหญ่
   - **Export Action Bar**: ประกอบด้วยปุ่มสำหรับกดเรียกใช้บริการบันทึกไฟล์ Markdown, PDF, หรือ Excel (.csv)

3. **[App.tsx](file:///d:/Dev/gitlab-req-manager/src/renderer/App.tsx)**:
   - เพิ่มการตรวจสอบพารามิเตอร์ตอนที่หน้าต่างเปิดขึ้นมา หากตรวจพบ `?page=report` ให้สลับการทำงานไป Render หน้าเพจ `ReportDetail` ทันทีเพื่อรองรับหน้าต่างแยกขนาดใหญ่

