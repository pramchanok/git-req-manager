# Infisical Setup — macOS Release Workflow

Self-hosted Infisical: **https://infisical.igenco.dev**

## สิ่งที่ต้องทำ

### 1. สร้าง Project ใน Infisical

1. เข้า https://infisical.igenco.dev
2. สร้าง project ใหม่ (เช่น `gitlab-mr-manager`)
3. จด **project slug** ไว้ (ดูจาก URL หรือ Project Settings)
4. ใส่ project slug แทน `YOUR_PROJECT_SLUG` ใน `.github/workflows/release-mac.yml`

### 2. เพิ่ม Secrets ใน Infisical (Environment: `prod`)

| Secret Name | ค่า | รายละเอียด |
|-------------|-----|-----------|
| `CSC_LINK` | Base64-encoded `.p12` certificate | Apple Developer certificate |
| `CSC_KEY_PASSWORD` | password ของ certificate | - |
| `APPLE_ID` | Apple ID email | ใช้สำหรับ notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password | สร้างได้ที่ https://appleid.apple.com → Sign-In and Security → App-Specific Passwords |

> **วิธีแปลง certificate เป็น Base64 (CSC_LINK):**
> ```bash
> base64 -i certificate.p12 | tr -d '\n'
> ```

### 3. สร้าง Machine Identity ใน Infisical

1. ไปที่ Organization Settings → Access Control → Machine Identities
2. สร้าง Machine Identity ใหม่
3. Assign ให้มี `read` access ใน project ที่สร้าง
4. สร้าง Client Secret → เก็บ `Client ID` และ `Client Secret` ไว้

### 4. เพิ่ม Secrets ใน GitHub Repository

ไปที่ GitHub repo → Settings → Secrets and variables → Actions → New repository secret

| Secret Name | ค่า |
|-------------|-----|
| `INFISICAL_CLIENT_ID` | Client ID จาก Machine Identity |
| `INFISICAL_CLIENT_SECRET` | Client Secret จาก Machine Identity |

### 5. ทดสอบ

รัน workflow `Release macOS` ผ่าน GitHub Actions → Actions tab → Release macOS → Run workflow
