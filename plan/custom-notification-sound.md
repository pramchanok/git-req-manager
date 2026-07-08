# Plan: Custom Notification Sound Settings

**Feature**: ให้ผู้ใช้เลือกหรือเปลี่ยนเสียงแจ้งเตือนได้เองในหน้า Settings

---

## ภาพรวม (Overview)

ปัจจุบันเสียงแจ้งเตือนทุกอันใช้เสียง OS default (`silent: false` ในทุก Notification) ซึ่งไม่สามารถปรับแต่งได้จากในแอป Feature นี้จะ:
1. ปิดเสียง OS notification แล้วเล่นเสียงเองจาก main process
2. ให้ผู้ใช้ตั้งค่าเสียง Default สำหรับเหตุการณ์ "สร้าง MR ใหม่" และ "MR ถูก Merge"
3. ให้ผู้ใช้ตั้งค่าเสียงแยกรายบุคคล (Member Specific) โดยกำหนดจาก Username ได้
4. ผู้ใช้สามารถเลือกจากเสียงที่ built-in มาให้ หรือ custom file `.wav` ของตัวเอง
5. เปิดหน้าต่างใหม่ (New Window) สำหรับการตั้งค่าเสียงโดยเฉพาะ เพื่อให้มีพื้นที่แสดงตารางรายชื่อ Member ได้อย่างชัดเจน

---

## รายละเอียดทางเทคนิค (Technical Details)

### ปัญหาของ ASAR Packaging
ไฟล์เสียงภายใน `.asar` archive ไม่สามารถเล่นผ่าน OS audio command ได้โดยตรง (เพราะ OS ไม่รู้จัก virtual path ของ asar)

**วิธีแก้**: ใช้ `extraResources` ใน `electron-builder` เพื่อ copy ไฟล์เสียงไปไว้ภายนอก `.asar` ที่ `resources/sounds/` เมื่อ package แอป

### วิธีเล่นเสียงใน Main Process
| Platform | คำสั่ง |
|----------|--------|
| macOS | `afplay "/path/to/sound.wav"` |
| Windows | PowerShell: `(New-Object Media.SoundPlayer 'C:\path\to\sound.wav').PlaySync()` |

---

## Proposed Changes (การเปลี่ยนแปลงที่เสนอ)

### 1. ⚙️ Types (`src/shared/types.ts`)
```ts
export type NotificationEvent = 'new_mr' | 'mr_merged'
export type NotificationSound = 'default' | 'none' | 'chime' | 'success' | 'alert' | 'custom'

export interface MemberSoundConfig {
  onNewMR: NotificationSound;
  onNewMRCustomPath?: string;
  onMerged: NotificationSound;
  onMergedCustomPath?: string;
}

export interface Settings {
  // ... existing fields ...
  defaultSoundConfig: MemberSoundConfig;
  memberSoundConfigs: Record<string, MemberSoundConfig>; // Key คือ username
}
```

### 2. ⚙️ Store (`src/main/store.ts`)
ปรับ `StoreSchema` ให้เก็บข้อมูลในรูปแบบใหม่:
- `defaultSoundConfig`: เก็บ Object ของ `MemberSoundConfig`
- `memberSoundConfigs`: เก็บ Object / Record ที่มี Key เป็น username

### 3. 🔊 Audio Player (`src/main/audio.ts`) [NEW]
```ts
export async function playNotificationSound(
  soundType: string,
  customPath?: string
): Promise<void>
```
- ถ้า `soundType === 'default'` → ไม่ต้องทำอะไร (ปล่อย OS เล่นเอง)
- ถ้า `soundType === 'none'` → ไม่เล่นเสียง
- ถ้าเป็น type อื่น → หาไฟล์จาก `resources/sounds/<type>.wav` แล้วสั่งเล่น
- ถ้า `soundType === 'custom'` → เล่นจาก `customPath`

Logic หา path ของ sound file:
```ts
function getSoundPath(filename: string): string {
  if (app.isPackaged) {
    // ภายนอก ASAR ใน resources/sounds/
    return path.join(process.resourcesPath, 'sounds', filename)
  }
  // Dev mode: จาก assets/sounds/
  return path.join(__dirname, '../../assets/sounds', filename)
}
```

### 4. 🔔 Notifier (`src/main/notifier.ts`)
ปรับทุกฟังก์ชัน notify:
- ดึง `username` ของผู้สร้าง MR (author) และพิจารณาว่าเป็น Event อะไร (`new_mr` หรือ `mr_merged`)
- ค้นหาเสียงจาก `memberSoundConfigs[username]` ก่อน หากไม่ได้ตั้งค่าไว้ ให้ดึงจาก `defaultSoundConfig`
- ถ้าชนิดของเสียง `!== 'default'` → เพิ่ม `silent: true` ใน Notification options
- เรียก `playNotificationSound()` จาก `audio.ts` ตามชนิดและ custom path ที่ดึงมาได้

### 5. 🎛️ IPC Bridge (ไฟล์ที่ต้องแก้)

#### `src/preload.ts`
```ts
selectCustomSoundFile: () => ipcRenderer.invoke('select-custom-sound-file'),
testNotificationSound: (soundType: string, customPath?: string) =>
  ipcRenderer.invoke('test-notification-sound', soundType, customPath),
openSoundSettingsWindow: () => ipcRenderer.invoke('open-sound-settings-window'),
```

#### `src/main/index.ts` (setupIPC)
```ts
ipcMain.handle('select-custom-sound-file', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Audio', extensions: ['wav'] }],
    properties: ['openFile'],
  })
  return filePaths[0] ?? null
})
ipcMain.handle('test-notification-sound', async (_, soundType, customPath) => {
  await playNotificationSound(soundType, customPath)
})
ipcMain.handle('open-sound-settings-window', () => {
  // สร้างและเปิด Browser window ใหม่ โหลด path หน้า Sound Settings
})
```

#### `src/renderer/electron.d.ts`
```ts
selectCustomSoundFile: () => Promise<string | null>
testNotificationSound: (soundType: string, customPath?: string) => Promise<void>
openSoundSettingsWindow: () => Promise<void>
```

### 6. 📦 Assets & Packaging

#### ไฟล์เสียงที่ต้องเตรียม (`assets/sounds/`)
| ชื่อไฟล์ | คำอธิบาย |
|---------|----------|
| `chime.wav` | เสียงระฆังเบาๆ |
| `success.wav` | เสียงสำเร็จ |
| `alert.wav` | เสียงเตือนชัดเจน |

> ไฟล์เสียงสามารถหาได้จาก royalty-free sound library หรือ macOS system sounds

#### `package.json` (electron-builder config)
```json
"extraResources": [
  {
    "from": "assets/sounds/",
    "to": "sounds/"
  }
]
```

### 7. 🎨 Settings UI & New Window

เนื่องจากหน้าจอการตั้งค่าแบบแยก Member ค่อนข้างซับซ้อน (มีตารางรายชื่อ) จึงจะทำเป็นหน้าต่างย่อย (Sub-window) แยกต่างหาก เพื่อไม่ให้หน้าหลักเล็กเกินไป

#### `src/renderer/pages/Settings.tsx` (หน้าเก่า)
- เพิ่มแค่ปุ่ม: `[ 🎛️ Configure Notification Sounds... ]`
- พอกดปุ่มจะไปเรียก `window.electronAPI.openSoundSettingsWindow()`

#### `src/main/windows/soundSettings.ts` [NEW]
- ฟังก์ชันสำหรับสร้าง `BrowserWindow` ใหม่ (กำหนดขนาดให้เหมาะสม เช่น 600x500)
- ชี้ไปที่ router URL (เช่น `/#/sound-settings`)

#### `src/renderer/pages/SoundSettings.tsx` [NEW]
หน้าต่างสำหรับจัดการเสียง:
- **Default Sounds Section:**
  - Dropdown: New MR Sound + Test Button
  - Dropdown: MR Merged Sound + Test Button
- **Member Specific Sounds Section:**
  - Input เพิ่ม Username ใหม่
  - ตารางแสดง Username ที่ตั้งค่าไว้ พร้อม Dropdown 2 ตัว (New MR / Merged) และปุ่มลบ (Remove)

---

## IPC Checklist

| Channel | preload.ts | index.ts | electron.d.ts |
|---------|-----------|----------|---------------|
| `select-custom-sound-file` | ✅ expose | ✅ handle | ✅ type |
| `test-notification-sound` | ✅ expose | ✅ handle | ✅ type |
| `open-sound-settings-window` | ✅ expose | ✅ handle | ✅ type |

> การจัดการ State (Save/Load settings) ใช้ผ่าน `app-state-updated` และ `save-settings` ปกติที่วางระบบไว้แล้ว

---

## Edge Cases & Guard Rails

| Case | วิธีรับมือ |
|------|-----------|
| ไฟล์เสียง custom หายไป | Catch error, log ไว้ และ fallback เล่น OS default |
| ไม่พบ `resources/sounds/` ตอน packaged | Log warning, silent fail |
| Windows: PowerShell ถูก block | Catch error, silent fail — ไม่ crash แอป |
| ผู้ใช้เลือก file ที่ไม่ใช่ `.wav` | Dialog filter บังคับ `.wav` เท่านั้น |

---

## Verification Plan

### Manual Testing
1. เปิด Settings → เลือก "Chime" → กด Test → ได้ยินเสียง chime
2. เลือก "Custom File" → Browse เลือกไฟล์ .wav → กด Test → ได้ยินเสียงที่เลือก
3. เลือก "Silent" → trigger MR notification → ไม่มีเสียง
4. เลือก "System Default" → trigger MR notification → ได้ยินเสียง OS default
5. ทดสอบ packaged build: `npm run package:mac` → เปิดแอป → เล่นเสียงได้ถูกต้อง

### Build Validation
```bash
npm run build
```

---

## Priority: P2 (ความสวยงาม/ประสบการณ์ใช้งาน)

ฟีเจอร์นี้ไม่ได้ blocking แต่ช่วยให้แอปรู้สึก polished และ professional มากขึ้น
