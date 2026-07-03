# Changelog

## [1.7.5] - 2026-07-03

### การแก้ไขข้อผิดพลาด (Bug Fixes)

- **แก้ไขปุ่ม Merge กดไม่ติด**: แก้ไขปัญหาที่ทำให้กดปุ่ม Merge แล้วไม่มีอะไรเกิดขึ้นสำหรับ MR ที่ Pipeline โดนเซ็ตเป็น `skipped` (หรือเสร็จไปนานแล้ว) สาเหตุมาจากระบบพยายามจะส่งคำสั่ง "Auto-Merge" ไปทุกรอบ ทำให้ GitLab ปฏิเสธการ Merge (ตอนนี้จะส่งคำสั่ง Auto-Merge เฉพาะตอนที่ Pipeline มีสถานะเป็น Running เท่านั้น)

---

## [1.7.4] - 2026-07-03

### ฟีเจอร์ใหม่ & การปรับปรุง (New Features & Improvements)

- **ดูสถานะและยกเลิก Pipeline** — เพิ่มระบบสำหรับดูสถานะของ Pipeline ได้ชัดเจนขึ้น:
  - **เปิดดูผ่านเบราว์เซอร์ได้ทันที**: สามารถคลิกที่ป้ายสถานะ Pipeline ตรงส่วนหัวของ MR เพื่อเปิดเว็บหน้า Pipeline ของ GitLab ขึ้นมาดู Log ได้ทันที
  - **กด Cancel Pipeline**: หาก Pipeline มีสถานะเป็น Running จะมีปุ่มกากบาท (x) โผล่ขึ้นมาข้างๆ เพื่อให้คุณสามารถกดสั่ง Cancel Pipeline จากตัวแอปได้โดยตรง ไม่ต้องสลับหน้าต่างไปมาแล้ว!

---

## [1.7.3] - 2026-07-03

### ฟีเจอร์ใหม่ & การปรับปรุง (New Features & Improvements)

- **Auto-Merge (Merge When Pipeline Succeeds)** — รองรับระบบ Auto-Merge ของ GitLab อย่างสมบูรณ์ หากคุณกดปุ่ม Merge ขณะที่ Pipeline ยังวิ่งอยู่ (ขึ้นสถานะ Running) ปุ่มจะเปลี่ยนเป็นคำว่า `Auto-Merge` และเมื่อกด ตัวแอปจะสั่ง `merge_when_pipeline_succeeds: true` ไปที่ GitLab ทำให้มันจะไปตั้งสถานะรอ Merge อัตโนมัติเมื่อ Pipeline วิ่งผ่าน เหมือนกับปุ่ม "Merge when pipeline succeeds" บนเว็บของ GitLab เด๊ะๆ ครับ!

---

## [1.7.2] - 2026-07-02

### การแก้ไขข้อผิดพลาด (Bug Fixes)

- **React ReferenceError Fix** — แก้ไขปัญหาจอขาว (ซ้ำซ้อน) ที่เกิดจากการเรียกใช้ `React.useMemo` โดยไม่ได้ทำการ Import ตัว `React` เข้ามาในหน้าต่าง MR Detail (เปลี่ยนไปใช้ `useMemo` แบบ Native แทน)

---

## [1.7.1] - 2026-07-02

### การแก้ไขข้อผิดพลาด (Bug Fixes)

- **White Screen Fix** — แก้ไขปัญหาจอขาวเมื่อเปิดหน้ารีวิว MR ซึ่งเกิดจากการเรียกใช้งาน Type จากไลบรารีที่ไม่ได้เป็น TypeScript (parse-diff) ผิดวิธี

---

## [1.7.0] - 2026-07-02

### ฟีเจอร์ใหม่ & การปรับปรุง (New Features & Improvements)

- **File Tree Sidebar** — เพิ่มแถบแสดงรายชื่อไฟล์ (File Tree) ไว้ด้านซ้ายของหน้าต่างรีวิว MR คล้ายกับของ GitLab ช่วยให้การค้นหาและเข้าถึงไฟล์ต่างๆ ง่ายขึ้น พร้อมมีระบบ Scroll-to-File อัตโนมัติเมื่อกดเลือก
- **GitLab-Style Accurate Diff Viewer** — ถอดระบบแสดง Diff เก่าออกและสร้าง Custom Diff Viewer ขึ้นมาใหม่เพื่อใช้อ่านและแสดงผลรูปแบบ Patch Diff อย่างถูกต้อง โดยแบ่งพื้นหลังสีแดง (โค้ดที่ลบออก) และสีเขียว (โค้ดที่เพิ่มใหม่) แบบเป๊ะๆ ตามต้นฉบับ ไม่เขียวล้วนอีกต่อไป
- **Inline Stats (+/-)** — เพิ่มการแสดงสถิติการเพิ่ม (+ สีเขียว) และการลบ (- สีแดง) ของจำนวนบรรทัดที่บริเวณรายชื่อไฟล์ใน File Tree และแถบหัวข้อไฟล์ เพื่อความรวดเร็วในการรีวิว
- **Code Syntax & Build Fix** — อัปเดต Tailwind CSS สู่เวอร์ชัน 4 อย่างสมบูรณ์ แก้ไขปัญหา Build ผิดพลาด และแก้ปัญหา Type Warning ของระบบ Electron

---

## [1.6.1] - 2026-07-02

### การแก้ไขข้อผิดพลาด (Bug Fixes)

- **Linux Auto-Update** — แก้ไขบั๊กที่ทำให้ระบบอัปเดตอัตโนมัติบน Linux (.AppImage) ไม่ทำงาน โดยเพิ่มการดึงไฟล์ `latest-linux.yml` ลงใน GitHub Actions และปรับโครงสร้างการตรวจสอบระบบปฏิบัติการในตัวอัปเดต

---

## [1.6.0] - 2026-07-02

### ฟีเจอร์ใหม่ & การปรับปรุง (New Features & Improvements)

- **Standalone MR Review Window** — ปรับปรุงหน้ารีวิว Merge Request ให้เปิดเป็นหน้าต่างแยก (Standalone Window) ขนาด 900x700 เต็มจอเพื่อให้อ่านโค้ดได้สะดวกขึ้น โดยไม่ซ้อนกับเมนูของแอปหลัก
- **Premium Dark UI Design** — ออกแบบหน้าตารีวิวใหม่ทั้งหมดด้วยโทนสี Dark Mode (Deep Charcoal) พร้อมสไตล์ Glassmorphism ให้ดูพรีเมียมและอ่านสบายตามากขึ้น
- **Chat-Style Discussions** — ปรับปรุงช่องคอมเมนต์และพูดคุยให้แสดงผลแบบ Chat Bubbles เหมือนแอปแชทสมัยใหม่ ช่วยให้ไล่อ่านประวัติได้ง่ายขึ้น
- **Mark as Viewed (Local Tracker)** — เพิ่ม Checkbox ให้สามารถติ๊ก "Viewed" ที่แต่ละไฟล์ได้ โดยไฟล์ที่ถูกติ๊กจะถูกพับโค้ดเก็บไปและขีดฆ่าชื่อไฟล์ทิ้ง และแอปจะจดจำสถานะนี้ไว้แบบออฟไลน์ (Local Storage) ทำให้กลับมารีวิวต่อได้โดยไม่สับสน
- **Smart Approve Button & Safe Close** — ปุ่ม Approve จะแสดงผลเสมอสำหรับ MR ที่เปิดอยู่เพื่อความสะดวก และย้ายปุ่ม Close MR ไปไว้ที่มุมขวาบนสุดเพื่อป้องกันการเผลอกดผิด

---

## [1.5.0] - 2026-06-29

### ฟีเจอร์ใหม่ (New Feature)

- **เพิ่มการรองรับ Linux** — เพิ่มการ Build แอปรองรับระบบปฏิบัติการ Linux (`.AppImage` และ `.deb`) ผ่าน GitHub Actions และปรับโครงสร้างให้ทำงานได้ข้ามแพลตฟอร์มอย่างสมบูรณ์

---

## [1.4.0] - 2026-06-26

### ฟีเจอร์ใหม่ (New Feature)

- **รายงานสรุปผลงานทีม (Team Performance Report)** — หน้ารายงานวิเคราะห์การทำงานของแต่ละคนในระดับกลุ่ม (GitLab Group) โดยสนับสนุนการกรองข้อมูลแบบ รายวัน (Daily), รายสัปดาห์ (Weekly), และรายเดือน (Monthly) พร้อมปุ่มปรับเดินหน้า/ถอยหลัง
- **ระบบจำกัดสิทธิ์ความปลอดภัย (Role-Based Access Control)** — ปิดกั้นไม่ให้ผู้ใช้งานทั่วไปเข้าถึงหน้ารายงานได้ โดยอนุญาตเฉพาะ GitLab Owner (ผู้เป็นเจ้าของกลุ่มระดับ min_access_level = 50) หรือ GitLab Administrator เท่านั้น และกรองแสดงผลกลุ่มเฉพาะที่ตนเองมีสิทธิ์เข้าถึงจริง
- **การเรนเดอร์เอกสารและหน้าต่างสรุปงานละเอียด (Markdown Report Detail Window)** — เมื่อคลิกเลือกตัวบุคคล จะเปิดหน้าต่างขนาดใหญ่แยกเฉพาะตัว (800x600px) เพื่อแสดงรายงานสรุปผลงานในรูปแบบเอกสาร Markdown ที่สวยงาม
- **การส่งออกข้อมูลได้หลากหลายฟอร์แมต (Multi-Format Export)** — สามารถส่งออกรายงานรายละเอียดผลงานเป็น Markdown (.md), PDF (.pdf คุณภาพสูงผ่านคำสั่งการพิมพ์ของเบราว์เซอร์), หรือ Excel (.csv พร้อม UTF-8 BOM ป้องกันฟอนต์ภาษาไทยเพี้ยน) ได้ในคลิกเดียว

### แก้ไขบั๊ก & ปรับปรุง (Bug Fixes & Improvements)

- **7-Day Activity History Fix** — แก้ไขบั๊กกราฟแท่งประวัติการทำงาน 7 วันไม่แสดงข้อมูล (แสดงเป็น 0) ในรายงานรายละเอียดของพนักงาน โดยการปรับปรุงการคำนวณช่วงวันให้สอดคล้องตาม Timezone ท้องถิ่นแบบไดนามิก และขยายขอบเขตการดึงข้อมูล API จาก GitLab ให้ครอบคลุมทุกช่วงเวลาที่ต้องใช้พล็อตชาร์ตย้อนหลังสัมพันธ์กับตัวกรอง
- **2-Row Header Layout** — ปรับโครงสร้างแถบควบคุมส่วนหัวของรายงานให้เป็นแบบ 2 บรรทัด เพื่อความกว้างขวางและอ่านง่าย ป้องกันส่วนแสดงช่วงวันที่ถูกย่อด้วยเครื่องหมายจุดไข่ปลา `...` รวมถึงแก้ปัญหาปุ่มตัวเลือกฟิลเตอร์ล้นจอด้านขวา
- **Dynamic Reset Button** — ปรับชื่อปุ่มล้างเวลากลับปัจจุบันให้สัมพันธ์กับฟิลเตอร์อัตโนมัติ ("Today" สำหรับรายวัน, "This Week" สำหรับรายสัปดาห์, "This Month" สำหรับรายเดือน)
- **Standardized Tailwind Classes** — ล้างคลาสสีเทาและขอบที่ไม่ได้ประกาศในระบบ (เช่น `gray-850/855/955`) เพื่อป้องกันไม่ให้เบราว์เซอร์แสดงเส้นแบ่งเป็นสีขาวสว่างเด่น โดยเปลี่ยนมาใช้คลาสเทาเข้มแบบกึ่งโปร่งแสงตามแนวดีไซน์ Glassmorphism ที่นุ่มนวลสบายตา
- **CI/CD Build Sequential Order** — ปรับโครงสร้างลำดับงานบน GitHub Actions ให้ฝั่ง Windows รอสร้างต่อจาก macOS ป้องกันปัญหาเกิด Draft Release ซ้ำซ้อนและล้มเหลวขณะ Finalize

---

## [1.3.9] - 2026-06-25

### ฟีเจอร์ใหม่ (New Feature)

- **แจ้งเตือนเมื่อ MR ของเราถูก Merge** — เพิ่มการแจ้งเตือน `✅ MR Merged!` สำหรับเจ้าของ MR เมื่อ Merge Request ที่ตัวเองสร้างถูก merge แล้ว รองรับทั้งสองโหมด:
  - **Polling Mode** — ตรวจจับทุกรอบ sync โดย track MR ที่ยัง open อยู่ และยืนยัน state ผ่าน API ก่อนแจ้งเตือน (กันแจ้งเตือนเมื่อ MR ถูก close แทน)
  - **Webhook Mode (Real-time)** — รับ event `action=merge` จาก GitLab Webhook และแจ้งเตือนทันทีโดยไม่ต้องรอรอบ sync ถัดไป
  - มีปุ่ม toggle ในหน้า Settings เพื่อเปิด/ปิดฟีเจอร์นี้ได้ (ค่าเริ่มต้น: เปิด)
  - ระบบ guard ป้องกันการแจ้งเตือนซ้ำ ด้วยการบันทึก MR ID ที่แจ้งไปแล้วใน persistent store

---

## [1.3.8] - 2026-06-18

### แก้ไขบั๊ก & ปรับปรุง (Bug Fixes & Improvements)

- **macOS Auto-Updater Restart Fix** — แก้ไขปัญหาเวลากด "Update and Restart" บน macOS/MacBook แล้วแอปค้าง ไม่ยอมปิดและเปิดใหม่โดยอัตโนมัติ โดยการข้ามตัวตรวจจับเหตุการณ์การปิดหน้าต่างปกติ (Prevent Window Close Interception) เพื่อให้กระบวนการอัปเดตของ Squirrel ทำงานได้อย่างลื่นไหล
- **App Version Display** — นำข้อความแสดงเวอร์ชันแอปพลิเคชันกลับมาแสดงผลตรงแถบ Title Bar ถัดจากชื่อแอป (เช่น `v1.3.8`) เพื่อให้อ่านง่ายขึ้น และยังสามารถคลิกที่เวอร์ชันเพื่อเปิดหน้า Changelog หรืออัปเดตได้โดยตรงเหมือนเดิม

---

## [1.3.7] - 2026-06-18

### ปรับปรุง UI/UX (UX/UI Redesign)

- **Bottom Navigation Bar** — ย้ายแถบเมนูหลักลงด้านล่างของหน้าต่างแอปเพื่อขยายพื้นที่ด้านกว้างให้กับการแสดงผลของบิลด์และรายการ Merge Request ทั้งหมดแบบ 100% ป้องกันข้อความบีบอัดตัวจนล้นบนหน้าต่างขนาด 380px
- **Title Bar Integration** — นำ Last Sync Timestamp และปุ่มกด Refresh (`↻`) ขึ้นไปไว้ในแถบ Title Bar ช่วยลดความหนาเทอะทะของ Header และถอด Footer ดำด้านล่างออกเพื่อประหยัดพื้นที่แนวตั้ง
- **Pill Segmented Tab Control** — ปรับโครงสร้างแถบนำทางและปุ่มเลือกแท็บย่อยให้แสดงผลเป็นรูปแบบแคปซูล (Pill Segmented Control) แทนแถบขีดเส้นใต้สีส้มสองแถวที่บดบังและรบกวนสายตา
- **Dashboard Grid Icon** — เปลี่ยนไอคอนของเมนู Dashboard จากรูปขีดสามขีด (Hamburger Menu) เป็นไอคอน Grid สี่ช่องเพื่อสื่อถึงหน้าหลักอย่างชัดเจนและไม่สับสน

---

## [1.3.6] - 2026-06-16

### ความเสถียรและระบบหลังบ้าน (Stability & Webhook Hardening)

- **Webhook Payload Limit** — เพิ่มขีดจำกัดขนาดของ Webhook payload ที่ 5MB เพื่อป้องกันการโจมตีหรือหน่วยความจำเต็ม
- **Webhook Timeout Guard** — ป้องกัน Webhook ค้างโดยการเพิ่ม Request Timeout ที่ 10 วินาที
- **Partial-Success Sync** — ปรับโครงสร้างระบบการดึงข้อมูล `Promise.all` มาเป็น `Promise.allSettled` ทำให้ในกรณีที่ GitLab API สำหรับรายการหนึ่ง (เช่น All Open MRs) ล้มเหลว รายการอื่นๆ (เช่น My Reviews) จะยังคงอัปเดตและทำงานต่อได้ตามปกติ
- **ลดการกลืน Error (Reduce Silent Failures)** — ปรับปรุงการจัดการ Error โดยให้แสดงผ่าน Error Category และ Log ข้อความความผิดพลาดที่เคยถูกซ่อนไป ให้โชว์อย่างชัดเจนในฝั่งของ `scheduler` และ `webhook`

---

## [1.3.5] - 2026-05-24

### เพิ่มฟีเจอร์ใหม่

- **Owner Group Notifications** — ถ้าคุณเป็น Owner ของ GitLab Group สามารถเปิดรับแจ้งเตือน MR ใหม่ทุกอันใน Group นั้นได้โดยตรงจากหน้า Settings; แสดงเฉพาะ Group ที่มีสิทธิ์ Owner เท่านั้น; แจ้งเตือนแบบรายอัน (≤5 MR) หรือ Summary notification (>5 MR) เพื่อป้องกัน spam

---

## [1.3.4] - 2026-05-21

### ปรับปรุง

- **allOpenMRs pagination** — ดึง MR เปิดทั้งหมดแบบ paginated แทนที่จะ hard-cap ที่ 100 รายการ รองรับ project ที่มี open MR มากกว่า 100 รายการ ทั้งในโหมด "All projects" และโหมดระบุ Project IDs

---

## [1.3.3] - 2026-05-17

### ปรับปรุง UI

- **Toast notifications** — แสดง toast เมื่อบันทึก Settings หรือ copy Webhook URL สำเร็จ; auto-dismiss ใน 2 วินาที
- **Page transitions** — fade-in animation เมื่อเปลี่ยน page
- **Keyboard shortcuts** — `Esc` กลับ Dashboard, `Ctrl/Cmd+R` sync, `Ctrl/Cmd+,` เปิด Settings
- **TeamReport last-activity** — แสดง "Active Xd ago" ใต้ชื่อ developer จาก open MR ล่าสุด
- **Empty state illustrations** — TeamReport empty state มี SVG icon แทนข้อความเปล่า
- **Scrollbar hide-until-hover** — scrollbar ซ่อนจนกว่าจะ hover container
- **Text color consistency** — ปรับ secondary text เป็น `text-gray-400`, tertiary เป็น `text-gray-600` ให้ consistent ทั้ง app
- **Fix close button** — nav tabs ไม่ push ปุ่มปิดออกนอกหน้าจอบน window แคบ

---

## [1.3.2] - 2026-05-17

### ปรับปรุง UI

- **แก้ hover bug `gray-750`** — `hover:bg-gray-750` ไม่ใช่ Tailwind class จริง ทำให้ hover ไม่มี feedback; แก้เป็น `hover:bg-gray-700/50`
- **CSS CI badge แทน emoji** — แทน 🟢/🔴/🟡 ด้วย CSS dot + ข้อความ "CI" เพื่อให้ sharp และ consistent ทุก platform
- **Hover accent border** — card ที่ hover จะมี orange left-border 2px โดยไม่มี layout shift (padding compensated)
- **Draft pill badge** — แทน inline text สีเหลืองด้วย rounded pill badge `Draft` ที่อ่านง่ายขึ้น
- **Age-based urgency บน timestamp** — MR ที่ค้างนาน ≥ 3 วัน แสดง timestamp สีเหลือง; ≥ 7 วัน แสดงสีแดง เพื่อให้เห็น stale MR ได้ทันที
- **Skeleton loading** — แทน "Loading…" text ด้วย shimmer skeleton cards ใน Dashboard และ skeleton dev rows ใน TeamReport ขณะโหลดข้อมูลครั้งแรก
- **Navigation bar** — เพิ่ม nav bar icon + label (Dashboard / Team / Settings) แทนปุ่ม emoji ที่ซ่อนอยู่ใน title bar ให้ค้นหาและใช้งานได้ง่ายขึ้น พร้อม active state และ update badge บน Settings tab

---

## [1.3.1] - 2026-05-14

### แก้ไข Bug

- **Labels ไม่แสดงใน MR Card** — แก้ bug ที่ `mapMR` อ่านจาก field `label_details` แต่ GitLab API คืนค่า labels ที่ field ชื่อ `labels` (เป็น objects เมื่อใช้ `with_labels_details: true`) ทำให้ labels ไม่แสดงเลยแม้จะมีการ fetch มาถูกต้อง

---

## [1.3.0] - 2026-05-14

### ฟีเจอร์ใหม่

- **แสดง Labels ใน MR Card** — แต่ละ MR จะแสดง labels ที่ติดอยู่เป็น chip สีตาม GitLab ใต้ชื่อ branch ในรายการ MR
- **แจ้งเตือนเมื่อ Labels เปลี่ยน** — เมื่อ label ของ MR ใดๆ ที่ติดตามอยู่มีการเพิ่มหรือลบ จะแจ้งเตือน notification พร้อมบอกว่า label ไหนเพิ่ม/ออก กดที่ notification เพื่อเปิด MR ได้เลย

---

## [1.2.9] - 2026-05-14

### แก้ไข Bug

- **macOS: โปรแกรม version เก่าไม่ปิดเมื่ออัปเดท** — แก้ 3 จุดที่ทำให้ old version ไม่ยอม quit และ new version เปิดไม่ได้หลังอัปเดท:
  - `window-all-closed` เรียก `e.preventDefault()` แม้ระหว่าง `quitAndInstall` ทำให้ quit ถูกบล็อกบน macOS; แก้โดย skip `preventDefault()` เมื่อ `isQuitting = true`
  - `quitAndInstall()` ขาด `isForceRunAfter=true` ทำให้ helper ไม่ relaunch new version หลัง install
  - `stopWebhookServer()` ใช้แค่ `server.close()` ที่ไม่ปิด existing connections ทำให้ Node.js event loop ค้างและ process ออกไม่ได้; เพิ่ม `server.closeAllConnections()`

---

## [1.2.8] - 2026-05-14

### CI/CD

- **Release All workflow** — เพิ่ม `release-all.yml` สำหรับ build และ publish macOS + Windows พร้อมกัน (parallel jobs) แล้ว update release notes ครั้งเดียวใน finalize job
- **แก้ Infisical action** — เปลี่ยน input `site-url` เป็น `domain` ให้ถูกต้องตาม `Infisical/secrets-action@v1.0.7`; แก้ `project-slug` ให้ตรงกับ project จริงใน Infisical

---

## [1.2.7] - 2026-05-12

### ฟีเจอร์ใหม่

- **Tray icon เปลี่ยนสีเมื่อมีอัปเดท** — icon กลายเป็นสีฟ้า/cyan เมื่อมี version ใหม่พร้อม (สีส้มยังคงแสดงเมื่อมี MR รอ review)
- **กด version ที่ footer เพื่อดู Changelog** — text `v1.x.x` ที่มุมล่างซ้ายกดได้เสมอ เปิดหน้า Changelog
- **Changelog scroll ไปที่ version ปัจจุบัน** — เปิดหน้า Changelog แล้วจะ scroll อัตโนมัติและ highlight version ที่ใช้อยู่

## [1.2.6] - 2026-05-12

### ฟีเจอร์ใหม่

- **หน้า Changelog** — เพิ่มหน้าแสดงประวัติการอัปเดตทั้งหมดภายในแอป
  - แสดงอัตโนมัติครั้งแรกหลัง update เป็น version ใหม่
  - กดปุ่ม "📋 ดูสิ่งที่เปลี่ยนแปลงทั้งหมด" ใน Settings เพื่อเปิดได้ตลอดเวลา
  - กดปุ่ม Back เพื่อกลับหน้า Dashboard

## [1.2.5] - 2026-05-12

### ฟีเจอร์ใหม่

- **Update indicator หลายจุด** — เมื่อมี version ใหม่ แอปจะแจ้งเตือนทุกจุดที่ผู้ใช้อาจเห็น:
  - **Tray menu** — แสดง item "🔔 Update available" หรือ "⬆️ Update ready — Click to install" ใน context menu
  - **Settings button** — dot สีส้ม (กะพริบ) ตอนกำลัง download, สีเขียวตอนพร้อม install
  - **Footer version** — ตัวอักษรเปลี่ยนสีและกดได้เพื่อไป Settings (สีส้มตอน downloading, สีเขียวตอนพร้อม)

---

## [1.2.4] - 2026-05-12

### ฟีเจอร์ใหม่

- **แสดง release notes ตอนมี update** — เพิ่ม section "สิ่งที่เปลี่ยนแปลง" ใน Settings ที่คลิก expand ดูได้ เมื่อมี version ใหม่พร้อม download หรือ install

### ปรับปรุง

- **CHANGELOG เป็นภาษาไทย** — release notes ทุก version เขียนเป็นภาษาไทย คำ technical คงเป็น English

---

## [1.2.3] - 2026-05-12

### แก้ไข Bug

- **Windows: หน้าต่างไม่แสดงขึ้นมาตอน launch (regression fix)** — เพิ่ม migration ที่ลบ registry entry รูปแบบเก่าของ startup (ที่ตั้งโดย v1.2.2 หรือก่อนหน้า โดยไม่มี argument `--openedAtLogin`); หากไม่มีการ migrate ค่า `launchAtStartup` จะถูก reset เป็น false ผิดพลาดตอน run ครั้งแรก และ registry entry เก่าจะทำให้หน้าต่างโผล่ขึ้นมาตอน login แทนที่จะซ่อนอยู่

## [1.2.2] - 2026-05-12

### แก้ไข Bug

- **Windows: หน้าต่างไม่แสดงขึ้นมาตอน launch** — เปลี่ยนจาก API `wasOpenedAtLogin` ที่ไม่เสถียร มาใช้ command-line argument `--openedAtLogin` แทน; หน้าต่างถูกซ่อนทุกครั้งที่เปิดแบบ manual สำหรับผู้ใช้ที่เปิด "Launch at Startup" ไว้
- **macOS: startup/login item ไม่ทำงาน** — แก้ workflow `release-all.yml` ที่ตั้ง `CSC_IDENTITY_AUTO_DISCOVERY=false` ผิด job ทำให้ build macOS ออกมาไม่มี code signing/notarization จนถูก Gatekeeper และ macOS Login Items (13+) ปฏิเสธ
- **macOS: หน้าต่างไม่ได้ focus หลัง tray click** — รอ `app.dock.show()` ให้เสร็จก่อน จึงค่อย `app.focus()` และ `win.show()` เพื่อให้หน้าต่างได้รับ focus อย่างถูกต้องเมื่อถูกเรียกจาก startup-hidden state
- **หน้าต่างที่ recreate ใหม่ติดค้างในสถานะซ่อน** — เพิ่ม guard `isInitialLaunch` เพื่อให้ logic การซ่อนตอน startup ใช้เฉพาะการ launch ครั้งแรกเท่านั้น; หน้าต่างที่ recreate ภายหลังจะแสดงขึ้นมาปกติ

---

## [1.2.0] - 2026-05-11

### ปรับปรุงประสิทธิภาพ

- **Pipeline fetch แบบ parallel** — การดึงสถานะ pipeline เริ่มทันทีพร้อมกับ `getAllOpenMRs` แทนที่จะรอให้เสร็จก่อน
- **Pipeline API throttling** — เรียก pipeline API เป็น batch ทีละ 5 รายการ เพื่อหลีกเลี่ยง rate limit ของ GitLab
- **Cache current user** — `getCurrentUser()` ถูก cache ต่อ 1 รอบ sync; ประหยัด 1 API call ต่อรอบ และ reset เมื่อเปลี่ยน settings
- **ลด payload ของ pipeline** — `getMRPipelines` ขอแค่ `per_page=1` เนื่องจากต้องการเฉพาะสถานะ pipeline ล่าสุด
- **Memoize TeamReport** — รายการ `filtered` และ `sorted` ใน TeamReport ใช้ `useMemo` เพื่อป้องกันการคำนวณซ้ำเมื่อ expand/collapse card
- **ตัด notifiedMRIds ที่ไม่ใช้** — `notifiedMRIds` ถูก prune หลังแต่ละรอบ sync ให้เหลือเฉพาะ MR ที่ยังเปิดอยู่ (สูงสุด 500) ป้องกันการ leak หน่วยความจำและ disk ในระยะยาว

---

## [1.1.1] - 2026-05-11

### แก้ไข Bug

- **macOS auto-update restart** — แก้ app ไม่เปิดขึ้นมาใหม่หลัง install update บน macOS; ใช้ `quitAndInstall(false, true)` เพื่อ relaunch อย่างถูกต้อง
- **macOS tray icon** — แก้ tray icon ไม่แสดงบน macOS โดยเปลี่ยนมาใช้ `createFromBuffer(fs.readFileSync())` แทน `createFromPath()` ซึ่งไม่รองรับ `.asar` archive
- **macOS Retina tray icon** — เพิ่ม `addRepresentation({ scaleFactor: 2 })` แบบ explicit เพื่อให้ icon คมชัดบนจอ Retina
- **macOS startup window** — app ไม่แสดงหน้าต่างตอน login startup อีกต่อไป; เริ่มต้นซ่อนอยู่ใน tray ตามที่ควรจะเป็น

### ฟีเจอร์ใหม่

- **Team Report group filter** — เพิ่มตัวเลือก group สำหรับกรอง Team Report ให้แสดงเฉพาะสมาชิกใน GitLab group ที่เลือก; ค่าที่เลือกจะถูกบันทึกและโหลดคืนในครั้งถัดไป

---

## [1.1.0] - 2026-05-07

### ฟีเจอร์ใหม่

- **Team Report** — แท็บใหม่แสดง developer ทุกคนที่มี MR activity (เปิด, review, assigned, merge ในช่วง 30 วันที่ผ่านมา)
- **CI pipeline status** — แสดง badge สถานะ pipeline (`running` / `success` / `failed` / `canceled`) บนแต่ละ MR card
- **แจ้งเตือน CI failure** — แจ้งเตือน desktop เมื่อ pipeline เปลี่ยนจาก `running` → `failed` บน MR ที่กำลัง review อยู่
- **Auto-update polling** — updater ตรวจสอบ release ใหม่ทุก 1 ชั่วโมง นอกเหนือจากตอนเปิดแอป

### แก้ไข Bug

- **Duplicate process ตอน launch** — แก้ Electron process หลายตัวเปิดขึ้นพร้อมกันเมื่อเปิดแอปซ้ำ (single-instance lock ทั้ง macOS และ Windows)
- **GitHub release draft** — release ถูก publish เป็น public แล้ว (ตั้ง `releaseType: "release"` ใน electron-builder config)
- **Windows NSIS target** — เปลี่ยนมาใช้ NSIS installer เพื่อให้ auto-update ทำงานได้อย่างถูกต้องบน Windows

---

## [1.0.0] - 2026-05-06

- Release แรก
- Dashboard แสดง GitLab MR ที่ได้รับมอบหมายให้ review
- Settings: GitLab URL, access token, refresh interval, project filter
- Webhook mode (local server, Cloudflare tunnel, Socket.IO relay)
- Polling mode fallback
- Desktop notification สำหรับ MR ที่ได้รับมอบหมายใหม่
- Build สำหรับ macOS และ Windows ผ่าน GitHub Actions
