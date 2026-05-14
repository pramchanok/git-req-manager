# Changelog

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
