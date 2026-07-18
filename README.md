# 🦊 GitLab MR Manager

Desktop app สำหรับติดตาม GitLab Merge Requests ที่รอ review หรือ merge — รองรับ Windows, macOS และ Linux

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![Tech](https://img.shields.io/badge/built%20with-Electron%20%2B%20TypeScript%20%2B%20React-orange)

---

## 📋 สารบัญ

- [Features](#-features)
- [การติดตั้ง](#-การติดตั้ง)
- [การตั้งค่าครั้งแรก](#-การตั้งค่าครั้งแรก)
- [วิธีใช้งาน](#-วิธีใช้งาน)
- [การ Build จาก Source](#-การ-build-จาก-source)
- [โครงสร้างโปรเจกต์](#-โครงสร้างโปรเจกต์)
- [FAQ](#-faq)

---

## ✨ Features

- 🔔 **Desktop Notification** — แจ้งเตือนเมื่อมี MR ใหม่ที่ assigned ให้คุณ review หรือเมื่อ MR ของคุณถูก Merge
- 📋 **My Reviews** — ดู MR ทุกตัวที่คุณเป็น reviewer
- 📂 **All Open MRs** — ดู MR เปิดอยู่ทั้งหมดในทุก repo ที่คุณมีสิทธิ์
- 👥 **Team Report** — สรุปสถานะ MR ของคนในทีม (Team members)
- ⚡ **Real-time Sync (Webhook)** — รับอัปเดตทันทีผ่าน Webhook พร้อมรองรับ Cloudflare Tunnel ในตัว
- ⏱️ **Auto Sync (Polling)** — ดึงข้อมูลใหม่อัตโนมัติตาม interval ที่ตั้งไว้ (เป็นทางเลือกแทน Webhook)
- 📌 **Pin Window** — ปักหมุดหน้าต่างให้อยู่บนสุดเสมอ (Always on Top)
- ⬆️ **In-app Updates** — แจ้งเตือนและอัปเดตเวอร์ชันใหม่ในตัวแบบ OTA พร้อมหน้าต่างติดตั้งที่สวยงาม
- 🔒 **Secure Token Storage** — เก็บ Personal Access Token ด้วย OS-level encryption
- 🌐 **รองรับ GitLab ทุกแบบ** — ทั้ง `gitlab.com` และ self-hosted GitLab

---

## 📦 การติดตั้ง

### วิธีที่ 1 — ดาวน์โหลด Installer (แนะนำ)

1. ไปที่หน้า [Releases](../../releases)
2. เลือก version ล่าสุด
3. ดาวน์โหลดไฟล์ตาม OS:
   - **Windows**: `GitLab.MR.Manager-x.x.x-Setup.exe`
   - **macOS**: `GitLab.MR.Manager-x.x.x.dmg`
   - **Linux**: `GitLab.MR.Manager-x.x.x.AppImage` หรือ `gitlab-mr-manager_x.x.x_amd64.deb`
4. ติดตั้งและรัน

> **macOS**: ถ้าขึ้น "unidentified developer" ให้ไป System Preferences → Security & Privacy → Open Anyway

### วิธีที่ 2 — Build จาก Source

ดูส่วน [การ Build จาก Source](#-การ-build-จาก-source)

---

## ⚙️ การตั้งค่าครั้งแรก

### ขั้นตอนที่ 1 — สร้าง GitLab Personal Access Token

1. เข้า GitLab → **User Settings** → **Access Tokens**
2. กด **Add new token**
3. ตั้งชื่อ เช่น `mr-manager`
4. เลือก Scope: ติ๊ก **`api`** (จำเป็นสำหรับฟีเจอร์ approve / merge / comment ในแอป — ถ้าต้องการแค่ดูอย่างเดียวใช้ `read_api` ได้ แต่ฟีเจอร์ review ในแอปจะใช้ไม่ได้)
5. กด **Create personal access token**
6. **คัดลอก token ทันที** (จะไม่สามารถดูได้อีก)

### ขั้นตอนที่ 2 — ตั้งค่าใน App

1. เปิด app → คลิก **⚙️** มุมขวาบน
2. กรอกข้อมูล:

| ช่อง | ตัวอย่าง | คำอธิบาย |
|------|---------|---------|
| **GitLab URL** | `https://gitlab.com` | URL ของ GitLab (ใส่ของ self-hosted ได้) |
| **Personal Access Token** | `glpat-xxxx...` | Token ที่สร้างในขั้นตอนที่ 1 |
| **Project IDs** | *(ว่างไว้)* | ระบุ project ID ถ้าอยากจำกัด scope (ถ้าว่างจะดึงจากทุก repo) |
| **Webhook Enabled** | `เปิด` | เปิดใช้งานการอัปเดตแบบ Real-time |
| **Custom Webhook URL** | `https://.../gitlab-webhook` | URL ของ relay server ที่รับ event จาก GitLab |
| **Team/Owner Groups** | `123, 456` | กรอก Group ID สำหรับดู Team Report |

> ตัวเลือก **Refresh Interval** (polling) และ **Cloudflare Tunnel** ถูกซ่อนไว้ในเวอร์ชันปัจจุบัน (โค้ดยังอยู่ — เปิดคืนได้ผ่าน feature flags ใน `Settings.tsx`)

3. กด **Save & Connect**

---

## 📖 วิธีใช้งาน

### หน้า Dashboard

```
┌─────────────────────────────────────────┐
│ 🦊 GitLab MR Manager      📌 ⚙️  ✕     │  ← Title bar (ลากย้ายหน้าต่างได้, ปักหมุดได้)
├──────────────┬─────────────┬────────────┤
│  Dashboard   │    Team     │  Settings  │  ← แท็บ (อยู่ด้านล่างสุดของแอป)
├──────────────┴─────────────┴────────────┤
│ 👤 somchai                              │
│  feat: add user login              !42  │  ← คลิกเพื่อเปิดใน browser
│  my-project · 2h ago                    │
│  main ← feature/login                   │
├─────────────────────────────────────────┤
│ ...                                     │
├─────────────────────────────────────────┤
│ ⬇️ Downloading update v1.10.10...       │  ← Update Banner (จะแสดงเมื่อมีอัปเดต)
└─────────────────────────────────────────┘
```

### การทำงานของแต่ละส่วน

| ส่วน | การทำงาน |
|------|---------|
| **Dashboard** | รวม MR ที่คุณเป็น Reviewer (My Reviews) และ MR ทั้งหมด (All Open) |
| **Team** | หน้าจอแสดง MR ของคนในกลุ่ม (ตั้งค่า Group ID ใน Settings) |
| **📌 Pin** | ปักหมุดหน้าต่างให้อยู่บนสุด (Always on top) ถึงแม้จะสลับไปโปรแกรมอื่นก็ไม่ซ่อนตัว |
| **คลิก MR card** | เปิด MR นั้นใน browser |
| **✕** | ซ่อน app ไว้ใน system tray (ไม่ได้ปิด) |

### System Tray

- **Icon สีเทา** — ไม่มี MR รอ review
- **Icon สีส้ม** — มี MR รอ review อยู่
- **คลิกซ้าย** — เปิด/ซ่อน หน้าต่าง
- **คลิกขวา** — เมนู (Open / Refresh / Quit)
- **เปิด app ซ้ำ** — จะดึง instance เดิมกลับมาแทนการเปิด process ใหม่
- **macOS** — เมื่อเปิดหน้าต่างจาก tray หรือ Dock จะเห็น icon ใน Dock และจะซ่อนกลับเมื่อซ่อนหน้าต่าง

### Desktop Notification

App จะแจ้งเตือนเมื่อ:
- มี MR ใหม่ที่ assigned ให้คุณ review
- คลิก notification เพื่อเปิด MR ใน browser

---

## 🛠️ การ Build จาก Source

### Requirements

- **Node.js** 18+ — [download](https://nodejs.org)
- **npm** 9+
- **Git**

### ขั้นตอน

```bash
# 1. Clone โปรเจกต์
git clone <repo-url>
cd gitlab-req-manager

# 2. ติดตั้ง dependencies
npm install

# 3. รัน development mode (hot-reload)
npm run dev

# 4. หรือ build แล้วรัน
npm run build
npm start
```

### Package เป็น Installer

```bash
# Windows (.exe installer)
npm run package:win

# macOS (.dmg)
npm run package:mac

# Linux (.AppImage, .deb)
npm run package:linux

# ทุกแพลตฟอร์ม
npm run package
```

ไฟล์จะอยู่ที่ `release/` folder

> **หมายเหตุ**: การ build สำหรับ macOS ต้องทำบนเครื่อง Mac เท่านั้น

### Scripts ทั้งหมด

| Command | การทำงาน |
|---------|---------|
| `npm run dev` | Development mode (Vite + tsc watch + Electron) |
| `npm run build` | Build renderer + main process |
| `npm run build:renderer` | Build React UI ด้วย Vite |
| `npm run build:main` | Compile TypeScript main process |
| `npm start` | รัน app จาก dist/ |
| `npm run package:win` | Package เป็น Windows installer |
| `npm run package:mac` | Package เป็น macOS .dmg |
| `npm run package:linux` | Package เป็น Linux .AppImage และ .deb |
| `npm run publish:win` | Build + publish Windows release ไป GitHub Releases |
| `npm run publish:mac` | Build + publish macOS release ไป GitHub Releases |
| `npm run publish:linux` | Build + publish Linux release ไป GitHub Releases |

### OTA Update ผ่าน GitHub Releases

App ใช้ `electron-updater` เช็กอัปเดตจาก GitHub Releases ของ repo นี้:

`https://github.com/pramchanok/git-req-manager`

สิ่งที่ต้องมี:

1. ตั้ง `version` ใน `package.json` ให้ตรงกับเวอร์ชันที่ต้องการปล่อย
2. สร้าง `GH_TOKEN` หรือ `GITHUB_TOKEN` ที่มีสิทธิ์ publish release
3. ใช้ `npm run publish:win` หรือ `npm run publish:mac` จากเครื่อง/CI ของแพลตฟอร์มนั้น
4. ปล่อย release บน GitHub โดยใช้ tag รูปแบบ `v1.0.1`

หมายเหตุ:

- **Windows auto-update** ใช้แพ็กเกจแบบ **NSIS installer**
- repo นี้มี GitHub Actions สำหรับปล่อย **Windows release อัตโนมัติเมื่อ push tag `v*`**
- **macOS auto-update** ต้อง build แบบ signed app และมีทั้ง `dmg` กับ `zip`
- ตอนรันใน dev (`npm run dev` / `npm start`) ระบบ update จะถูกปิดไว้ และจะทำงานจริงเฉพาะ packaged app

---

## 🗂️ โครงสร้างโปรเจกต์

```
gitlab-req-manager/
├── src/
│   ├── main/                   # Electron main process (Node.js)
│   │   ├── index.ts            # App bootstrap + BrowserWindow + IPC
│   │   ├── tray.ts             # System tray icon และ context menu
│   │   ├── scheduler.ts        # Polling loop + state management
│   │   ├── webhook.ts          # Local Webhook server
│   │   ├── tunnel.ts           # Cloudflare Tunnel integration
│   │   ├── socket-client.ts    # Socket.IO client สำหรับ Reverse Proxy
│   │   ├── updater.ts          # Auto-update logic
│   │   ├── notifier.ts         # Desktop notification
│   │   └── store.ts            # บันทึก settings (token เข้ารหัส)
│   ├── renderer/               # React UI
│   │   ├── App.tsx             # Root component + routing
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx   # หน้า MR list (My Reviews, All Open)
│   │   │   ├── TeamReport.tsx  # หน้า MR ของทีม
│   │   │   ├── Settings.tsx    # หน้า config
│   │   │   └── Changelog.tsx   # หน้าแสดงประวัติการอัปเดต
│   │   └── components/
│   │       └── MRCard.tsx      # การ์ดแสดง MR แต่ละรายการ
│   ├── shared/
│   │   ├── types.ts            # TypeScript interfaces
│   │   └── gitlab.ts           # GitLab REST API v4 client
│   └── preload.ts              # IPC bridge (contextBridge)
├── assets/
│   ├── tray-icon.png           # Tray icon ปกติ (สีเทา)
│   └── tray-icon-active.png    # Tray icon มี MR รอ (สีส้ม)
├── dist/                       # Build output (auto-generated)
├── release/                    # Packaged installers (auto-generated)
├── package.json
├── tsconfig.json               # TypeScript config (renderer)
├── tsconfig.main.json          # TypeScript config (main process)
└── vite.config.ts              # Vite config (renderer build)
```

> การตั้งค่า packaging (electron-builder) อยู่ใน `package.json` ฟิลด์ `"build"`

---

## ❓ FAQ

**Q: รองรับ GitLab self-hosted ไหม?**  
A: รองรับ ใส่ URL ของ GitLab instance ตัวเองได้เลย เช่น `https://gitlab.mycompany.com`

**Q: Token เก็บไว้ที่ไหน ปลอดภัยไหม?**  
A: Token ถูกเข้ารหัสด้วย OS-level encryption (`safeStorage` ของ Electron) ก่อนบันทึก ไม่ได้เก็บเป็น plain text

**Q: ต้องการ permission อะไรใน GitLab?**  
A: แนะนำ scope `api` เพราะแอปมีฟีเจอร์ approve, merge, close และ comment ใน MR ได้ (ถ้าใช้ `read_api` จะดูข้อมูลได้อย่างเดียว ฟีเจอร์ review จะใช้ไม่ได้)

**Q: All Open MRs แสดงได้กี่รายการ?**  
A: แสดงทั้งหมด — app ดึงครบทุกหน้าจาก GitLab API (pagination หน้าละ 100 รายการ)

**Q: ปิดหน้าต่างแล้ว app หายไปไหน?**  
A: app ยังทำงานอยู่ใน system tray มองหา icon 🦊 ใน notification area แล้วคลิกเพื่อเปิดกลับมา

**Q: Quit app ยังไง?**  
A: คลิกขวาที่ tray icon → **Quit**
