# Plan: Custom Notification Sound Settings

**Feature**: ให้ผู้ใช้เลือกหรือเปลี่ยนเสียงแจ้งเตือนได้เองในหน้า Settings

---

## ภาพรวม (Overview)

ปัจจุบันเสียงแจ้งเตือนทุกอันใช้เสียง OS default (`silent: false` ในทุก Notification) ซึ่งไม่สามารถปรับแต่งได้จากในแอป Feature นี้จะ:
1. ปิดเสียง OS notification แล้วเล่นเสียงเองจาก main process
2. ให้ผู้ใช้เลือกจากเสียงที่ built-in มาให้ หรือ custom file `.wav` ของตัวเอง

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

### 1. ⚙️ Store (`src/main/store.ts`)
เพิ่ม fields ใน `StoreSchema`:
```ts
notificationSound: 'default' | 'none' | 'chime' | 'success' | 'alert' | 'custom'
customSoundPath: string  // path ไฟล์ .wav ที่ผู้ใช้เลือก
```
- Default: `'default'` (ใช้เสียง OS เดิม)

### 2. 🔊 Audio Player (`src/main/audio.ts`) [NEW]
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

### 3. 🔔 Notifier (`src/main/notifier.ts`)
ปรับทุกฟังก์ชัน notify:
- ถ้า `notificationSound !== 'default'` → เพิ่ม `silent: true` ใน Notification options
- เรียก `playNotificationSound()` จาก `audio.ts` ต่อจากนั้น

### 4. 🎛️ IPC Bridge (3 files ต้องแก้)

#### `src/preload.ts`
```ts
selectCustomSoundFile: () => ipcRenderer.invoke('select-custom-sound-file'),
testNotificationSound: (soundType: string, customPath?: string) =>
  ipcRenderer.invoke('test-notification-sound', soundType, customPath),
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
```

#### `src/renderer/electron.d.ts`
```ts
selectCustomSoundFile: () => Promise<string | null>
testNotificationSound: (soundType: string, customPath?: string) => Promise<void>
```

### 5. 📦 Assets & Packaging

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

### 6. 🎨 Settings UI (`src/renderer/pages/Settings.tsx`)
เพิ่ม Section "🔊 Notification Sound" ใต้ Launch at Startup:
```
Notification Sound: [Dropdown: System Default / Silent / Chime / Success / Alert / Custom File]
                    [🔊 Test]  ← ปุ่มทดสอบเสียงทันที

(ถ้าเลือก Custom File)
Custom Sound File: [path...] [Browse]
```

### 7. ⚙️ Types (`src/shared/types.ts`)
```ts
export type NotificationSound = 'default' | 'none' | 'chime' | 'success' | 'alert' | 'custom'

export interface Settings {
  // ... existing fields ...
  notificationSound: NotificationSound   // NEW — default 'default'
  customSoundPath: string                // NEW — default ''
}
```

---

## IPC Checklist

| Channel | preload.ts | index.ts | electron.d.ts |
|---------|-----------|----------|---------------|
| `select-custom-sound-file` | ✅ expose | ✅ handle | ✅ type |
| `test-notification-sound` | ✅ expose | ✅ handle | ✅ type |

> `notificationSound` และ `customSoundPath` ผ่าน `save-settings` / `get-settings` เดิม ไม่ต้องเพิ่ม IPC

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
