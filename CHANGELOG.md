# Changelog

## [1.12.11] - 2026-07-25

### การแก้ไขข้อบกพร่อง (Bug Fixes)

- **ป้องกันหน้า Electron เปิดตอนเริ่ม Windows**: โหมด `npm run dev` จะไม่ลงทะเบียน `electron.exe` เป็นรายการ Startup อีกต่อไป ป้องกันหน้าเริ่มต้นของ Electron แสดงขึ้นมาแทนแอป

---

## [1.12.10] - 2026-07-25

### การปรับปรุง (Improvements)

- **ปรับปรุงรูปแบบการแจ้งเตือน**: ลดข้อความซ้ำและนำไอคอนขนาดใหญ่ออกจากเนื้อหา notification เพื่อให้แสดงผลกระชับและอ่านง่ายขึ้น
- **ปรับภาษาแจ้งเตือนให้สม่ำเสมอ**: ใช้ภาษาไทยร่วมกับคำเทคนิค GitLab เช่น `MR`, `Review`, `Merge`, `Pipeline` และเพิ่ม emoji ตามประเภทเหตุการณ์
- **ปรับปรุง Test และ Update notification**: ใช้รูปแบบหัวข้อและข้อความเดียวกับ notification ประเภทอื่น

---

## [1.12.9] - 2026-07-24

### การแก้ไขข้อบกพร่อง (Bug Fixes)

- **แก้ไอคอน Electron บน Windows ในโหมด dev**: แยก App User Model ID ของ dev ออกจาก release และกำหนดไอคอน taskbar ผ่าน Windows app details เพื่อไม่ให้ไอคอน Electron ถูกนำมาใช้แทน
- **ทำให้ไอคอนแอปสม่ำเสมอ**: ใช้ไอคอน GitLab MR Manager กับหน้าต่าง รายงาน MR, notification และ Dock/Taskbar ตามแพลตฟอร์ม

---

## [1.12.8] - 2026-07-23

### การแก้ไขข้อบกพร่อง (Bug Fixes)

- **จำตำแหน่ง Tray บน macOS**: เพิ่ม stable Tray GUID เพื่อให้ macOS จำตำแหน่งไอคอนใน menu bar ได้หลังเปิดแอปใหม่ อัปเดต หรือ reinstall
- **นำทางไฟล์ในหน้า Changes ได้ตรงตำแหน่ง**: คลิกไฟล์แล้วเลื่อนไปยังหัวการ์ดไฟล์ที่เลือกอย่างถูกต้อง
- **ปรับปรุง File Tree และ Diff Viewer**: แก้รายการท้ายสุดถูกแถบปุ่มบัง และลดอาการกระตุกระหว่างลากขอบหรือเลื่อน diff ขนาดใหญ่

---

## [1.12.7] - 2026-07-22

### การแก้ไขข้อบกพร่อง (Bug Fixes)

- **แยกคลิกซ้ายและคลิกขวาของ Tray บน macOS**: แก้ปัญหาคลิกซ้ายที่ไอคอน Tray แล้วเปิดทั้งหน้าต่างแอปและ context menu พร้อมกัน โดยให้คลิกซ้ายเปิด/ซ่อนหน้าต่างตามเดิม และเปิดเมนูเฉพาะเมื่อคลิกขวาผ่าน native `right-click` event
- **คงพฤติกรรม Tray ของ Windows/Linux**: จำกัด logic แบบ manual context menu ไว้เฉพาะ macOS ส่วน Windows และ Linux ยังคงใช้ `setContextMenu()` ตามเดิม

---

## [1.12.6] - 2026-07-22

### การแก้ไขข้อบกพร่อง (Bug Fixes)

- **ลำดับไฟล์ในหน้า Changes ตรงกันทั้งสองฝั่ง**: จัดลำดับ diff cards ฝั่งขวาตาม File Tree ฝั่งซ้าย ทำให้ไฟล์ที่อยู่บนสุดใน tree แสดงอยู่บนสุดในรายการ diff เช่นกัน และการคลิกไฟล์ไม่กระโดดไปยังตำแหน่งที่ดูไม่สัมพันธ์กัน
- **รักษาสถานะรายการเมื่อข้อมูล refresh**: เปลี่ยน React keys ของ file tree และ diff cards จาก index เป็น file path เพื่อป้องกัน component สลับตำแหน่งหรือคง state ผิดไฟล์เมื่อ GitLab ส่งลำดับข้อมูลใหม่

---

## [1.12.5] - 2026-07-21

### การแก้ไขข้อบกพร่อง (Bug Fixes)

- **แก้หน้ารายละเอียด MR กระพริบเองเป็นระยะ**: เดิมการรีเฟรชเบื้องหลังทุก 20 วินาที (และทุกครั้งที่ sync) จะสั่งโหลด discussions ใหม่พร้อมโชว์ spinner ทำให้เนื้อหาถูกล้างแล้วขึ้นใหม่ เหมือนกด refresh — เปลี่ยนการดึงข้อมูลเบื้องหลังเป็นแบบเงียบ (ไม่โชว์ spinner) อาการกระพริบจึงหายไป

### การปรับปรุง (Improvements)

- **Discussion แบบ real-time ผ่าน Note Hook**: เพิ่มการรับ GitLab `Note Hook` ในโหมด webhook — เมื่อมีคอมเมนต์ใหม่บน MR ที่เปิดอยู่ หน้ารายละเอียดจะดึง discussions ใหม่ทันทีแบบเงียบ แทนที่จะรอ poll รอบถัดไป และ note event จะไม่ trigger full sync (คอมเมนต์ไม่กระทบรายการ MR) เพื่อลดการเรียก API ที่ไม่จำเป็น รองรับทั้ง local webhook, tunnel และ relay
  - หมายเหตุ: webhook ที่ลงทะเบียนไว้ก่อนหน้านี้ต้องให้แอป sync ใหม่หนึ่งรอบ (สลับสวิตช์ webhook หรือบันทึกการตั้งค่าใหม่) เพื่อเปิด `note_events`

---

## [1.12.4] - 2026-07-21

### การแก้ไขข้อบกพร่อง (Bug Fixes)

- **แก้ "เริ่มพร้อมเปิดเครื่อง" ไม่ทำงานบน Linux**: Electron API `setLoginItemSettings()` เป็น no-op บน Linux ทำให้สวิตช์ไม่มีผลจริง เปลี่ยนมาจัดการไฟล์ autostart ตามมาตรฐาน freedesktop (`~/.config/autostart/<appId>.desktop`) เอง โดยตั้งชื่อไฟล์ตาม `build.appId` จาก `package.json` และรองรับทั้ง AppImage (`$APPIMAGE`) และ deb
- **แก้สวิตช์ startup เด้งกลับเป็นปิดเองบน Linux**: เดิม `getLoginItemSettings()` คืน `openAtLogin: false` เสมอบน Linux ทำให้ค่าถูกเขียนทับเป็น `false` ทุกครั้งที่เปิดแอป — ข้าม logic sync-from-OS นี้บน Linux โดยให้ค่าใน store เป็น source of truth
- **เริ่มแบบซ่อนลง tray เมื่อเปิดจาก autostart บน Linux**: รองรับ flag `--openedAtLogin` บน Linux เช่นเดียวกับ Windows

---

## [1.12.3] - 2026-07-20

### การปรับปรุง (Improvements)

- **Windows Installer ขนาดเท่าหน้า Update Splash**: ขยายหน้าต่างติดตั้งจาก `320×200` เป็น `400×300` ให้ตรงกับ `assets/splash.html` พร้อมจัดตำแหน่งโลโก้ ข้อความ และ progress bar ใหม่ตามสัดส่วน
- **Animation ลื่นขึ้นที่ 30 FPS**: เพิ่ม native logo animation จาก 15 FPS/30 เฟรม เป็น 30 FPS/60 เฟรม โดยคงรอบ animation สองวินาทีและคง progress bar แบบเปอร์เซ็นต์จริง

### การแก้ไขข้อบกพร่อง (Bug Fixes)

- **แก้โลโก้หายจาก Windows Installer**: เปลี่ยนการเปิด AVI จาก ANSI `ACM_OPENA` เป็น Unicode `ACM_OPENW` ให้ตรงกับ NSIS Unicode และเพิ่มโลโก้ static ใน BMP เป็น fallback หาก animation เปิดไม่ได้

---

## [1.12.2] - 2026-07-20

### การปรับปรุง (Improvements)

- **Animation ของ Windows Installer อยู่ที่โลโก้**: ย้าย animation ออกจาก progress bar ไปยังบริเวณโลโก้ โดยใช้ native Windows `SysAnimate32` และ AVI แบบสร้างซ้ำได้ เพื่อให้ animation ทำงานต่อเนื่องระหว่าง NSIS แตกไฟล์
- **Progress bar แสดงความคืบหน้าจริง**: คืนแถบติดตั้งเป็น determinate progress ตามเปอร์เซ็นต์การแตกไฟล์จริง แทนแถบ marquee ที่วิ่งวน

---

## [1.12.1] - 2026-07-20

### การปรับปรุง (Improvements)

- **Modern Windows Installer**: ออกแบบหน้าติดตั้ง Windows ใหม่ให้ตรงกับธีมของแอป (`#0d1117`) พร้อม native marquee animation ของ Windows progress control ซึ่งเคลื่อนไหวได้ต่อเนื่องระหว่าง extraction และใช้ static splash ที่ไม่ถูก dialog repaint ทับ
- **เอกสาร Architecture และ Project Skills**: เพิ่มเอกสารภาพรวมโครงสร้าง process/data flow พร้อม Codex skills เฉพาะโครงการสำหรับ Electron features, GitLab API, release/packaging, NSIS installer, renderer UI และ sync/webhook debugging

### การแก้ไขข้อบกพร่อง (Bug Fixes)

- **แก้ animation ของ Windows Installer**: เปลี่ยนจาก NSIS script timer ซึ่งหยุดทำงานระหว่าง synchronous extraction มาใช้ animation ที่ทำงานใน native progress control พร้อมตัด animated bitmap assets ที่ไม่จำเป็น
- **แสดง Changelog หลังอัปเดตอย่างเชื่อถือได้**: แก้ race condition ที่ main process ส่ง event ก่อน React ลง listener พร้อมเพิ่ม version baseline สำหรับ first install และ renderer-to-main startup handshake สำหรับการเปิด Changelog หลังอัปเดต

---

## [1.12.0] - 2026-07-20

### คุณสมบัติใหม่ (New Features)

- **Pipeline Mini Graph แบบ GitLab**: แสดงสถานะ pipeline ราย stage ในหน้า MR Detail ข้าง badge สถานะเดิม — ไอคอนสถานะแต่ละ stage เรียงตามลำดับจริงของ pipeline, hover เพื่อดูรายการ jobs ในแต่ละ stage พร้อมสถานะและ duration, คลิก job เพื่อเปิดหน้า job บน GitLab ได้ทันที และ auto-refresh ทุก 10 วินาทีขณะ pipeline กำลังทำงาน

### การปรับปรุง (Improvements)

- **ออกแบบปุ่ม "Delete source branch" ใหม่**: เปลี่ยนจาก checkbox เป็น toggle pill ที่คลิกได้ทั้งก้อน พร้อม mini switch และสถานะเปิด/ปิดที่ชัดเจน เข้ากับโทนของแอป
- **Loading indicator ครบทุก action**: ปุ่ม Approve / Revoke / Merge / Close MR / Cancel Pipeline แสดง spinner พร้อมข้อความสถานะ (เช่น "Merging…") เฉพาะปุ่มที่กดขณะรอ API, emoji reaction แสดงสถานะกำลังส่งและป้องกันการกดซ้ำ, ปุ่ม refresh บน title bar หมุนขณะ sync
- **หน้า MR Detail อัปเดตแบบเรียลไทม์**: broadcast ข้อมูล sync ไปทุกหน้าต่าง (ไม่ใช่แค่หน้าต่างหลัก) ทำให้หน้าต่าง MR Detail ที่เปิดอยู่ refresh สถานะ MR, approvals, discussions และ emoji ทันทีเมื่อ webhook/polling sync เสร็จ, โหลด diffs ใหม่อัตโนมัติเมื่อมี commit ใหม่ push เข้ามา (ตรวจจาก head SHA) และเร่ง fallback poll ของ discussions จาก 60 → 20 วินาที
- **ปรับปรุง Performance**: หน้าต่างหลักเปิดเร็วขึ้นมาก — code splitting แยกหน้า MR Detail/Report ออกจาก bundle หลัก (เล็กลง 84% จาก ~2 MB เหลือ ~320 KB), cache สถานะ pipeline ราย MR (ข้ามการยิง API ซ้ำเมื่อ MR ไม่เปลี่ยนและสถานะเป็น terminal, TTL 5 นาที), cache รายชื่อ Owner Groups 10 นาที และหน้าต่าง MR Detail เช็คข้อมูลจาก state ที่ broadcast มาก่อน ถ้า MR นั้นไม่มีอะไรเปลี่ยนจะไม่ยิง API ซ้ำ
- **สถานะ Pipeline แบบ push ผ่าน Webhook**: สมัครรับ `pipeline_events` ใน webhook ที่แอปจัดการให้อัตโนมัติ — สถานะ pipeline บน badge และ Dashboard อัปเดตเกือบทันทีเมื่อ pipeline เริ่ม/สำเร็จ/ล้มเหลว พร้อม debounce การ sync 2 วินาทีกัน event รัวจาก pipeline stage, โหมด webhook ลด poll สถานะ MR เหลือ fallback ทุก 30 วินาที (โหมด polling ยัง 15 วินาที) — webhook เดิมที่ลงทะเบียนไว้ก่อนหน้าจะได้รับ pipeline events หลังกด Save ใน Settings หนึ่งครั้ง และโหมด relay ต้องอัปเดต relay server ให้ forward pipeline event ด้วย

---

## [1.11.0] - 2026-07-18

### คุณสมบัติใหม่ (New Features)

- **เริ่มพร้อมเปิดเครื่องเป็นค่าเริ่มต้น (Launch at Startup by Default)**: เปิดใช้งานการเริ่มแอปอัตโนมัติพร้อมเปิดเครื่องเป็นค่าเริ่มต้น (มีผลกับเครื่องที่ติดตั้งอยู่แล้วครั้งเดียวหลังอัปเดต — ยังสามารถปิดเองได้ที่หน้า Settings ตามปกติ) พร้อมรองรับการลงทะเบียน Login Item บน macOS
- **ตัวเลือกลบ Source Branch ตอน Merge**: เพิ่ม checkbox "Delete source branch" ข้างปุ่ม Merge ในหน้า MR Detail เลือกได้ว่าจะให้ลบ source branch หลัง merge หรือไม่ (ค่าเริ่มต้น: ลบ)
- **แจ้งเตือน MR ถูก Merge แบบเรียลไทม์ผ่าน Relay Server**: โหมด Custom Webhook URL (relay) รองรับการแจ้งเตือน "MR ของเราถูก Merge" แบบทันทีแล้ว (ต้องอัปเดต relay server เป็นเวอร์ชันที่ส่ง `mrIid`/`authorId` มาด้วย)

### การปรับปรุง (Improvements)

- **ปรับหน้า Settings ให้เรียบง่ายขึ้น**: ซ่อนตัวเลือก Cloudflare Tunnel และ Refresh Interval (Polling) ออกจาก UI เนื่องจากปัจจุบันใช้ Custom Webhook URL เป็นหลัก (โค้ดยังอยู่ครบ เปิดคืนได้ผ่าน feature flags)
- **Refactor โครงสร้างโค้ด Renderer ครั้งใหญ่**: แตกหน้า MRDetail, ReportDetail และ Settings ออกเป็น component ย่อยใน `components/mr-detail/`, `components/report/`, `components/settings/` พร้อมแยก logic สร้างรายงาน (Markdown/CSV) เป็น pure function ใน `utils/reportBuilder.ts` เพื่อให้ดูแลรักษาและเขียน test ได้ง่ายขึ้น (ไม่มีการเปลี่ยนแปลงพฤติกรรมการใช้งาน)

### ความปลอดภัย (Security)

- **ป้องกัน XSS ในการแสดงผล Markdown**: sanitize HTML ด้วย DOMPurify ทุกจุดที่ render เนื้อหาจาก GitLab (comment ใน MR, รายงาน, release notes) และ escape HTML ใน diff viewer
- **จำกัดการเปิดลิงก์ภายนอก**: อนุญาตเฉพาะ URL แบบ `http:`/`https:` เท่านั้น (บล็อก `file://` และ protocol อื่น)
- **ลดพื้นที่โจมตีของ Webhook**: โหมด relay ไม่เปิด local HTTP server อีกต่อไป และโหมด tunnel จะ generate secret ให้อัตโนมัติถ้ายังไม่ได้ตั้งค่า

### การแก้ไขข้อบกพร่อง (Bug Fixes)

- แก้ไขปัญหาเปลี่ยน token/GitLab URL แล้วแอปยังจำ user เดิมค้างไว้จนกว่าจะ restart (reset cache ทันทีเมื่อบันทึก Settings)
- แก้ไขการบันทึก token ล้มเหลวเงียบๆ บนเครื่องที่ OS keychain ใช้งานไม่ได้ (เช่น Linux ที่ไม่มี keyring) โดย fallback เป็นการเก็บแบบเข้ารหัส base64 พร้อมคำเตือน
- อัปเดตเอกสาร: scope ของ Personal Access Token ที่ถูกต้องคือ `api` (จำเป็นสำหรับฟีเจอร์ approve/merge/comment)

---

## [1.10.10] - 2026-07-17

### การแก้ไขข้อบกพร่อง (Bug Fixes)

- ยกเลิกการสร้าง Desktop Shortcut ซ้ำซ้อนเวลาที่มีการติดตั้งอัปเดตเวอร์ชันใหม่ (ตัวแอปจะทำงานอยู่เบื้องหลังและอยู่ที่ Tray เสมอ)
- **แสดงหน้าต่างอัปเดตที่ปรับแต่งใหม่ (Update Splash Screen)**: เปลี่ยนการติดตั้งอัปเดตแบบซ่อน (Silent Install) เป็นแบบแสดงหน้าต่าง Splash Screen สีเข้มที่ปรับแต่งใหม่ พร้อมข้อความ "Installing..." และแถบโหลด เพื่อให้ผู้ใช้รับทราบสถานะ

## [1.10.9] - 2026-07-17

### คุณสมบัติใหม่ (New Features)

- **แถบแจ้งเตือนการอัปเดต (Global Update Banner)**: เพิ่มแถบแจ้งเตือนเมื่อมีอัปเดตใหม่ที่ด้านล่างของแอป (เหนือเมนู) เพื่อให้สังเกตเห็นได้ง่ายขึ้นเวลาแอปดาวน์โหลดอัปเดตแบบเบื้องหลัง คล้ายกับแถบอัปเดตของ VS Code หรือ Cursor

## [1.10.8] - 2026-07-17

### การแก้ไขข้อบกพร่อง (Bug Fixes)

- แก้ไขปัญหาบั๊กของฟีเจอร์ Pin ที่เมื่อกดปุ่ม X เพื่อซ่อนหน้าต่าง หรือเปิดหน้าต่างใหม่จาก Tray จะทำให้แอปโหลดใหม่ (Reset) และลืมสถานะการปักหมุดเดิม

## [1.10.7] - 2026-07-16

### คุณสมบัติใหม่ (New Features)

- **หน้าต่างติดตั้งแบบปรับแต่งเอง (Custom NSIS UI)**: เปลี่ยนมาใช้ Custom UI สำหรับ Installer โดยตัดหน้าต่างเลือกร่วมออกเพื่อให้ติดตั้งแบบ 1-click และซ่อนหน้าต่าง Installer พื้นฐานของระบบลงเพื่อความพรีเมียม
- **ฟังก์ชันปักหมุดหน้าต่าง (Pin Window)**: เพิ่มปุ่ม Pin 📌 ที่หน้าต่างหลัก ช่วยให้ผู้ใช้งานสามารถเลือกล็อกหน้าต่างไว้บนสุด (Always on Top) ได้ หรือถ้าไม่ได้ปักหมุด หน้าต่างก็จะหุบลง Tray อัตโนมัติเวลาสลับไปหน้าจออื่น

### การแก้ไขข้อบกพร่อง (Bug Fixes)

- แก้ไขปัญหาแอปไม่ซ่อนตัวลง Tray ตามปกติหลังจากทำการติดตั้งเสร็จสิ้น

## [1.10.6] - 2026-07-16

### คุณสมบัติใหม่ (New Features)

- **หน้าต่างติดตั้งและการอัปเดตแบบไร้รอยต่อ (Seamless Updater Splash Screen)**:
  - เพิ่มหน้าต่าง Splash Screen แบบโปร่งใส (Glassmorphism) ตอนเปิดแอป เพื่อตรวจสอบและดาวน์โหลดการอัปเดตให้เสร็จก่อนเข้าสู่แอปพลิเคชัน
  - การติดตั้งอัปเดตจะเป็นแบบทำงานอยู่เบื้องหลัง (Silent Install) 100% โดยผู้ใช้จะไม่เห็นหน้าต่างติดตั้งแบบดั้งเดิมของ Windows อีกต่อไป
  - แสดงสถานะการดาวน์โหลด (Progress bar) อัตโนมัติที่หน้าต่าง Splash Screen
  - แจ้งเตือนผลลัพธ์การอัปเดต (เช่น "You are up to date! 🎉") ก่อนปิด Splash Screen
- **ปรับปรุง UI สำหรับการอัปเดตแอป**:
  - เพิ่มแถบโหลดเปอร์เซ็นต์ (Progress bar) สีส้ม (แบรนด์ของแอป) แบบเรียลไทม์ไว้ที่เมนูอัปเดตแบบ Dropdown ด้วย

---
## [1.10.5] - 2026-07-16

### คุณสมบัติใหม่ (New Features)

- **ปรับปรุง UI สำหรับการอัปเดตแอป (Auto-Update UI)**: 
  - เพิ่มเมนู Dropdown บริเวณเลขเวอร์ชันมุมซ้ายบนของหน้าจอ สำหรับกดตรวจสอบการอัปเดต (Check for Updates) และดูประวัติการอัปเดต (Changelog) ได้อย่างรวดเร็วและสะอาดตา
  - เพิ่มเมนูคำสั่งคลิกขวาที่ System Tray Icon เพื่อให้กดเช็คอัปเดตแอปได้โดยไม่ต้องเปิดหน้าต่างแอป
  - ปรับดีไซน์การ์ด App Updates ใหม่ในหน้า Settings ให้ดูพรีเมียมขึ้น พร้อมแสดงแถบเปอร์เซ็นต์การดาวน์โหลดอัปเดตแบบเรียลไทม์
  - ย้ายตัวบอกเวลาการอัปเดตข้อมูลล่าสุด (Last Synced) ไปรวมกลุ่มไว้กับปุ่ม Refresh (↻) เพื่อให้ผู้ใช้งานเข้าใจได้ง่ายขึ้น

---
## [1.10.4] - 2026-07-16

### การปรับปรุง (Improvements)

- **ปรับเปลี่ยนดีไซน์ System Tray Icon ใหม่**: ยกเลิกการใช้ไอคอนแจ้งเตือนสีขาว-ดำแบบเดิม และเปลี่ยนมาใช้ **"โลโก้หลักของแอป"** ในสถานะต่างๆ แทนเพื่อความคลีนและสวยงามแบบมินิมอล:
  - **สถานะปกติ (ไม่มี MR ใหม่):** โลโก้แอปสีเทา (`tray-icon-grey`)
  - **สถานะ Active (มี MR ต้องรีวิว):** โลโก้แอปสีส้มปกติ (`tray-icon-app`) ช่วยให้เห็นชัดเจนขึ้น
  - **สถานะ Update (มีแอปเวอร์ชันใหม่):** โลโก้แอปสีฟ้าล้วน (`tray-icon-update-app`)

---

## [1.10.3] - 2026-07-15

### การแก้ไขข้อผิดพลาด (Bug Fixes)

- **ปุ่ม Merge ใช้งานไม่ได้เมื่อ Pipeline ล้มเหลว**: ปรับปรุงการทำงานของปุ่ม Merge ให้สามารถกดได้แม้ว่าสถานะ Pipeline จะเป็น `failed` เพื่อรองรับกรณีที่โปรเจกต์ตั้งค่าอนุญาตให้ Merge ได้แม้ Pipeline จะไม่ผ่าน (เช่น โปรเจกต์ที่ไม่ได้บังคับ `Pipelines must succeed`) โดยจะเช็คจากสิทธิ์ในการ Merge `user_can_merge` ของผู้ใช้แทน

---

## [1.10.2] - 2026-07-15

### การแก้ไขข้อผิดพลาด (Bug Fixes)

- **Markdown Rendering Fix**: แก้ไขบั๊กที่ข้อความยาวๆ ในช่อง Comment (เช่น จาก AI Code Review) แสดงผลเป็นข้อความธรรมดา (Plain Text) ไม่มีสไตล์หรือการขึ้นบรรทัดใหม่ โดยทำการติดตั้งปลั๊กอิน `@tailwindcss/typography` กลับเข้าไปใน Tailwind v4 และเปิดใช้งาน `remark-breaks` เพื่อให้แสดงผลหัวข้อ, ตัวหนา, และ Bullet Points ได้ถูกต้องเหมือนในหน้าเว็บ GitLab

---

## [1.10.1] - 2026-07-14

### ปรับปรุง UI/UX (UX/UI Improvements)

- **หน้าต่างรายละเอียด MR (MR Detail Window)**: ปรับปรุงส่วน Header ให้ดู Premium ยิ่งขึ้น (ย้ายชื่อโปรเจกต์ไปเป็น Breadcrumb ด้านบน, ย้ายป้ายกำกับ Label และสถานะทั้งหมดลงมาเรียงใน Meta Row ด้านล่าง เพื่อให้ชื่อ MR สามารถแสดงผลได้เต็มพื้นที่และสวยงาม ไม่เบียดทับกัน)


## [1.10.0] - 2026-07-12

### ฟีเจอร์ใหม่ & การปรับปรุง (New Features & Improvements)

- **ค้นหาและเรียงลำดับ MR (Dashboard Filter & Sort)**: เพิ่มแถบเครื่องมือในหน้า Dashboard ให้สามารถพิมพ์ค้นหา MR (จากชื่อ MR, ชื่อคนสร้าง หรือชื่อโปรเจกต์) และเลือกเรียงลำดับรายการตามเวลาที่อัปเดตหรือจำนวน Approve ที่ยังขาดอยู่ได้
- **ระบบเลือกโปรเจกต์แบบค้นหา (Project Selector UI)**: เปลี่ยนช่องกรอก Project IDs แบบเก่าในหน้า Settings เป็นช่องค้นหาโปรเจกต์จาก GitLab API โดยตรง สามารถพิมพ์ชื่อโปรเจกต์และกดคลิกเพิ่มเข้าสู่ระบบได้ง่ายขึ้น ไม่ต้องไปนั่งจำ ID อีกต่อไป
- **หน้าต่างแสดงสถานะระบบ (Health / Status Panel)**: เพิ่มปุ่ม Status บริเวณด้านขวาบนของแท็บ Dashboard สามารถคลิกเพื่อดูสถานะการเชื่อมต่อ GitLab API, สถานะการตั้งค่าแอป, และข้อผิดพลาดล่าสุด (Error logs) ได้ทันที

### ความปลอดภัยและระบบหลังบ้าน (Security & Hardening)

- **Sanitize HTML Changelog**: ปรับปรุงหน้าต่างแสดง Changelog ให้ใช้ `dompurify` เพื่อช่วยกรองแท็ก HTML ที่ไม่ปลอดภัย ป้องกันการฝังโค้ดอันตราย (XSS)
- **CI/CD Quality Gates**: เพิ่มระบบ Unit Test (`vitest`) ให้รันอัตโนมัติก่อนที่จะทำการ Build หรือ Package แอปพลิเคชัน เพื่อป้องกันความผิดพลาด

## [1.9.10] - 2026-07-10

### ฟีเจอร์ใหม่ & การปรับปรุง (New Features & Improvements)

- **สถานะปุ่ม Approve อัตโนมัติ (Dynamic Approve Button)**: ปรับปรุงปุ่ม Approve ให้เปลี่ยนเป็นปุ่ม "Revoke approval" ทันทีที่คุณกด Approve ไปแล้ว (พร้อมรองรับการกดยกเลิกการ Approve) ทำให้ทราบสถานะการอนุมัติของตัวเองอย่างชัดเจน ไม่หลงกดซ้ำ
- **ตรวจสอบสิทธิ์การจัดการ MR (MR Action Permissions)**: เพิ่มการเช็คสิทธิ์ `can_merge` ของผู้ใช้งานจาก GitLab API เพื่อป้องกันไม่ให้ผู้ใช้ที่ไม่มีสิทธิ์ หรือไม่ใช่เจ้าของ MR (Author) กดปุ่ม Close MR, Approve, และ Merge ได้ พร้อมแสดงข้อความอธิบาย (Tooltip) เมื่อปุ่มถูกปิดใช้งาน
- **เปิดรายละเอียด MR ภายในแอป (In-App MR Viewer)**: ปรับปรุงหน้ารายงานสรุปผลงานทีม (Team Report) ให้สามารถเปิดดูรายละเอียดของ MR ได้โดยตรงจากในตัวแอป (Standalone Window) แทนการเด้งไปเปิดหน้าเว็บเบราว์เซอร์ภายนอก ทั้งจากการคลิกการ์ดรายการ MR และการคลิกลิงก์จากหน้า Raw MD

---

## [1.9.9] - 2026-07-08

### การแก้ไขข้อผิดพลาด (Bug Fixes)

- **แสดงไอคอน Electron บนหน้าต่างย่อย**: แก้ไขบั๊กหน้าต่าง Developer Report และหน้าต่าง MR Detail แสดงไอคอนแอปผิดพลาดเป็นรูป Electron บน Windows Taskbar (เกิดจากการอ้างอิง path รูปภาพผิดวิธีเมื่อรันผ่านไฟล์ `.asar`) โดยปรับมาใช้ `nativeImage` ในการโหลดรูปภาพเช่นเดียวกับหน้าต่างหลัก

## [1.9.8] - 2026-07-08

### การแก้ไขข้อผิดพลาด (Bug Fixes)

- **แสดงไอคอน Electron บน Windows Taskbar**: แก้ไขหน้าต่างหลักไม่แสดงไอคอนแอปบน Taskbar ของ Windows โดยระบุไอคอน `nativeImage` ให้ถูกต้องตั้งแต่ตอนสร้างหน้าต่าง
- **ย้ายโฟลเดอร์ติดตั้งกลับเป็นชื่อเดิม (Windows)**: เพิ่ม `installer.nsh` บังคับให้ NSIS (ระบบติดตั้ง) ของ Windows กลับไปใช้โฟลเดอร์ `$LOCALAPPDATA\Programs\GitLab MR Manager` แทนที่จะเป็น `gitlab-req-manager` เพื่อให้ชื่อโฟลเดอร์กลับมาสื่อความหมายตรงกัน และระบบอัปเดตจะย้ายแอปให้ผู้ใช้ปัจจุบันอัตโนมัติอย่างราบรื่น

## [1.9.7] - 2026-07-08

### ฟีเจอร์ใหม่ & การปรับปรุง (New Features & Improvements)

- **จัดระเบียบหน้าจอ MR Detail (UX Improvements)**:
  - **ส่วนหัว (Header)**: ปรับลดความสูงและจัดเรียงข้อมูลให้กะทัดรัดขึ้น เพื่อเพิ่มพื้นที่ให้ส่วนแสดงเนื้อหาตรงกลาง
  - **แถบเครื่องมือด้านล่าง (Action Bar)**: เปลี่ยนชื่อปุ่มปิดหน้าต่างเป็น "Back" และจัดกลุ่มเมนูนำทางไว้ฝั่งซ้าย แยกกับปุ่มจัดการ MR (Approve, Merge) ไว้ฝั่งขวาอย่างชัดเจน ป้องกันความสับสน
  - **ปุ่ม Pipeline**: ออกแบบปุ่มยกเลิกการรัน Pipeline (Cancel) แยกออกมาให้เห็นชัดเจนและกดง่ายขึ้น

### การแก้ไขข้อผิดพลาด (Bug Fixes)

- **ป้องกันการเผลอปิด MR (Close MR Protection)**: ย้ายปุ่ม Close MR จากด้านบนลงมาด้านล่าง ปรับสีเป็นสีแดง (Danger Action) และเพิ่มหน้าต่างแจ้งเตือนยืนยัน (Confirmation Modal) เพื่อป้องกันการเผลอกดผิด
- **ตำแหน่งหน้าต่าง Emoji (Emoji Picker Alignment)**: แก้ไขหน้าต่างเลือกอีโมจิให้เด้งขึ้นมาตรงกลางในตำแหน่งที่ถูกต้อง ไม่ทับซ้อนกับปุ่มด้านล่างหรือล้นออกนอกจอ

---

## [1.9.6] - 2026-07-08

### การแก้ไขข้อผิดพลาด (Bug Fixes)

- **Markdown Editor Alignment**: แก้ไขปัญหา Cursor ในช่อง Comment (Markdown) พิมพ์ไม่ตรงบรรทัดกับข้อความ โดยเฉพาะข้อความภาษาไทย เนื่องจากฟอนต์ของช่องพิมพ์กับช่องแสดงผลไม่ตรงกัน

---

## [1.9.5] - 2026-07-08

### การแก้ไขข้อผิดพลาด (Bug Fixes)

- **macOS Auto-Update Broken**: แก้ไขปัญหาผู้ใช้ macOS ไม่สามารถอัปเดตแอปอัตโนมัติได้ (`Could not locate update bundle for com.gitlab-req-manager.app`) จากการเปลี่ยนค่า AUMID ในเวอร์ชันก่อนหน้า โดยตอนนี้ได้ระบุค่า `appId` เฉพาะเจาะจงให้ macOS กลับไปเป็นค่าดั้งเดิมเพื่อให้ระบบอัปเดตทำงานได้ปกติ

### ปรับปรุงประสิทธิภาพ (Performance Improvements)

- **ลดอาการหน่วง (UI Sluggishness)**: ปรับปรุงการส่งข้อมูลข้ามโปรเซส (IPC) ให้ส่งเฉพาะสถานะการซิงก์ (Lightweight Sync Status) แทนการส่งข้อมูลทั้งหมด และใช้งาน `React.memo` เพื่อป้องกันการเรนเดอร์หน้าจอใหม่ซ้ำซ้อน ช่วยให้แอปลื่นไหลขึ้นอย่างมาก
- **ดึงข้อมูลกลุ่มพร้อมกัน (Concurrent Fetching)**: ปรับวิธีการดึงข้อมูล Merge Request จากตั้งค่ารายกลุ่ม ให้ร้องขอผ่าน API ไปพร้อมๆ กัน (`Promise.all`) แทนการรอทีละกลุ่ม ช่วยให้การซิงก์ข้อมูลเสร็จเร็วขึ้น

---

## [1.9.4] - 2026-07-07

### การแก้ไขข้อผิดพลาด (Bug Fixes)

- **แก้ไขปัญหา AppImage บน Linux**: ถอดไลบรารี `axios` ออกและเปลี่ยนไปใช้ `fetch` มาตรฐานของ Node.js เพื่อแก้ปัญหา `fromDataURI` และ `AxiosError` ที่เกิดจากข้อจำกัดในการอ่านไฟล์จำลองของ AppImage

---

## [1.9.3] - 2026-07-07

### การแก้ไขข้อผิดพลาด (Bug Fixes)

- **คลิกแจ้งเตือนแล้วไม่เปิดแอป**: เปลี่ยน AppUserModelId ใหม่เพื่อแก้ปัญหา Windows Action Center จำค่าผิดพลาด ทำให้บางครั้งคลิกแจ้งเตือนแล้วไปเปิดหน้าจอ Electron แทนที่จะเปิดหน้าจอแอป
- **สถานะปุ่ม Auto-Merge**: ปรับปรุงปุ่ม Merge ให้เปลี่ยนสถานะเป็น "Auto-Merge Enabled" และปิดการกดซ้ำ หลังจากที่เปิดใช้งาน Auto-Merge ไปแล้ว

---

## [1.9.2] - 2026-07-07

### การแก้ไขข้อผิดพลาด (Bug Fixes)

- **นำรูปโลโก้ออกจากเนื้อหาการแจ้งเตือน**: ปรับปรุงหน้าตาของการแจ้งเตือนบน Windows ให้สะอาดตาขึ้น โดยนำรูปโลโก้แอปที่ซ้ำซ้อนกันในเนื้อหาออกไป (ให้แสดงเฉพาะบน Header เท่านั้น)
- **ชื่อแอปบนการแจ้งเตือน**: บังคับให้ระบบแสดงชื่อแอปเป็น "GitLab MR Manager" เพื่อแก้ปัญหาที่การแจ้งเตือนบางครั้งแสดงชื่อเป็น "Electron" ในระหว่างการรันแบบ Development หรือยังไม่ได้ผูก AUMID

---

## [1.9.1] - 2026-07-07

### การแก้ไขข้อผิดพลาด (Bug Fixes)

- **การแจ้งเตือนขาดไอคอนและชื่อแอป**: แก้ไขระบบแจ้งเตือน (Notifications) ให้แสดงผลไอคอนแอปและชื่อแอปอย่างถูกต้องในทุกประเภทการแจ้งเตือน
- **การคลิกแจ้งเตือนไม่เปิดแอป**: เปลี่ยนพฤติกรรมเมื่อคลิกการแจ้งเตือน จากเดิมที่เปิดเบราว์เซอร์ ไปเป็นการเปิดหน้าต่าง MR ภายในแอปพลิเคชันโดยตรง เพื่อประสบการณ์ใช้งานที่ลื่นไหลยิ่งขึ้น

---

## [1.9.0] - 2026-07-07

### ฟีเจอร์ใหม่ & การปรับปรุง (New Features & Improvements)

- **📝 เพิ่มกล่องพิมพ์คอมเมนต์แบบเต็มรูปแบบ (Rich Text Markdown Editor)**: อัปเกรดช่องแสดงความคิดเห็นจากเดิมที่เป็นแค่กล่องข้อความธรรมดา ให้กลายเป็น Markdown Editor แบบครบเครื่อง พร้อมแถบเครื่องมือสำหรับปรับแต่งข้อความ และปุ่มเพิ่มรูปหน้ายิ้ม (Emoji Picker) สำหรับเลือกไอคอนต่างๆ แทรกในข้อความได้
- **👍 เพิ่มระบบตอบกลับด้วยอีโมจิ (MR Award Emojis)**: ในหน้า Overview ของ MR ใต้กล่อง Description จะมียอดอีโมจิแสดงขึ้นมาให้เห็นชัดเจน (เช่น 👍 หรือ 👎) พร้อมฟังก์ชันกดเพิ่ม/ลบอีโมจิของตัวเองได้ทันทีแบบ Real-time และมีเมนู Emoji Picker ให้เลือกอีโมจิรูปแบบอื่นๆ มารีแอคเพิ่มเติมได้อีกด้วย

### การแก้ไขข้อผิดพลาด (Bug Fixes)
- **หน้า Modal เทียบ Commit ว่างเปล่า**: แก้ปัญหาแอปพลิเคชันค้างจนหน้าจอขาว (White Screen Error) จากการคำนวณ File Tree ผิดพลาดเมื่อเปิดดูหน้าต่างเทียบ Commit ย้อนหลัง (Compare with previous version)
- **การดึงรหัส Commit ผิดพลาด**: ปรับปรุงกลไกให้สามารถแยกแยะและดึงรหัส Commit (SHA) จากข้อความที่ถูกครอบด้วยลิงก์ Markdown ได้อย่างแม่นยำ ทำให้กดดูลิงก์ Diff ของ Commit ได้ถูกต้องเสมอ
- **การเปิดเมนู Emoji ทำงานผิดปกติ**: แก้บั๊กที่หน้าต่างเลือกอีโมจิ (Reaction Picker) เด้งปิดตัวเองทันทีที่กดปุ่มเปิด

---

## [1.8.0] - 2026-07-04

### ฟีเจอร์ใหม่ & การปรับปรุง (New Features & Improvements)

- **🚀 ยกเครื่องหน้าตาแอปขนานใหญ่ (UX/UI Overhaul)**: ปรับปรุงหน้าจอ MR Detail ทั้งหมดให้สวยงามและใช้งานง่ายขึ้นในระดับเดียวกับเครื่องมือโปรแกรมเมอร์มืออาชีพ!
  - **หน้า Overview (ภาพรวม MR):**
    - **รองรับ Markdown เต็มรูปแบบ**: ตอนนี้ช่อง Description สามารถแสดงผลตัวหนา โค้ดบล็อก และ Checklist แบบกดได้แล้ว! (เหมือนใน GitLab เป๊ะ)
    - **ดีไซน์คอมเมนต์ใหม่**: แยกประวัติการทำงานของระบบ (เล็กๆ) กับแชทคอมเมนต์ของคน (กล่องใหญ่ๆ) ออกจากกันชัดเจน ทำให้อ่านง่ายขึ้นมาก
  - **หน้า Changes (ดูความเปลี่ยนแปลงโค้ด):**
    - **แถบ File Tree ยืดหดได้**: สามารถคลิกและลากขอบด้านซ้ายเพื่อปรับขนาดความกว้างของรายชื่อไฟล์ได้ หรือกดปุ่มพับเก็บ (Collapse) เพื่อกางโค้ดแบบเต็มจอ
    - **โหมด Split View**: เพิ่มปุ่มสลับมุมมองว่าอยากดูโค้ดแบบ Inline (บน-ล่าง) หรือ Split (ซ้าย-ขวา) ซึ่งเป็นมุมมองโปรดของใครหลายๆ คน
    - **มีสีสันให้โค้ด (Syntax Highlighting) & แถบ Gutter**: ตัวโค้ดจะถูกแต่งแต้มสีสันให้อ่านง่ายขึ้นเหมือนดูใน VS Code พร้อมแถบหมายเลขบรรทัด (Gutter) ที่แบ่งแยกชัดเจน

---

## [1.7.6] - 2026-07-04

### ฟีเจอร์ใหม่ & การปรับปรุง (New Features & Improvements)

- **ขยายขนาดหน้าต่าง MR เริ่มต้น**: ปรับเพิ่มขนาดความกว้างและความสูงเริ่มต้นของหน้าต่างดูรายละเอียด MR (จากเดิม 900x700 เป็น 1200x800) เพื่อให้มีพื้นที่ในการดูโค้ด Diff และ File Tree ได้สบายตามากยิ่งขึ้น ไม่ต้องคอยกดขยายหน้าต่างเองบ่อยๆ

---

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
