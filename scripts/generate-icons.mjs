/**
 * Generates all required app icons from SVG source
 * Run with: node scripts/generate-icons.mjs
 */
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const assetsDir = path.join(__dirname, '..', 'assets')

// ─── SVG Designs ─────────────────────────────────────────────────────────────

const appIconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FC6D26"/>
      <stop offset="100%" style="stop-color:#E24329"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="52" ry="52" fill="url(#bg)"/>
  <circle cx="72" cy="182" r="18" fill="white"/>
  <circle cx="184" cy="182" r="18" fill="white"/>
  <circle cx="128" cy="68" r="18" fill="white"/>
  <path d="M72 164 C72 124 114 90 128 86" stroke="white" stroke-width="13" fill="none" stroke-linecap="round"/>
  <path d="M184 164 C184 124 142 90 128 86" stroke="white" stroke-width="13" fill="none" stroke-linecap="round"/>
  <polygon points="128,44 110,76 146,76" fill="white"/>
</svg>`

const trayNormalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" width="22" height="22">
  <circle cx="11" cy="11" r="9" fill="#64748b"/>
  <circle cx="7.5" cy="15" r="2.2" fill="white"/>
  <circle cx="14.5" cy="15" r="2.2" fill="white"/>
  <circle cx="11" cy="7" r="2.2" fill="white"/>
  <path d="M7.5 12.8 C7.5 10 11 8.8 11 9.2" stroke="white" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M14.5 12.8 C14.5 10 11 8.8 11 9.2" stroke="white" stroke-width="1.6" fill="none" stroke-linecap="round"/>
</svg>`

const trayActiveSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" width="22" height="22">
  <circle cx="11" cy="11" r="9" fill="#FC6D26"/>
  <circle cx="7.5" cy="15" r="2.2" fill="white"/>
  <circle cx="14.5" cy="15" r="2.2" fill="white"/>
  <circle cx="11" cy="7" r="2.2" fill="white"/>
  <path d="M7.5 12.8 C7.5 10 11 8.8 11 9.2" stroke="white" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M14.5 12.8 C14.5 10 11 8.8 11 9.2" stroke="white" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <circle cx="17.5" cy="4.5" r="4" fill="#ef4444"/>
</svg>`

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function svgToPng(svgString, outputPath, size) {
  await sharp(Buffer.from(svgString)).resize(size, size).png().toFile(outputPath)
  console.log(`  ✓ ${path.basename(outputPath)} (${size}x${size})`)
}

function buildIco(pngBuffers, sizes) {
  const HEADER_SIZE = 6
  const ENTRY_SIZE = 16
  const count = pngBuffers.length
  let offset = HEADER_SIZE + ENTRY_SIZE * count

  const entries = pngBuffers.map((buf, i) => {
    const entry = { size: sizes[i], offset, length: buf.length }
    offset += buf.length
    return entry
  })

  const buffer = Buffer.alloc(offset)
  buffer.writeUInt16LE(0, 0)
  buffer.writeUInt16LE(1, 2)
  buffer.writeUInt16LE(count, 4)

  entries.forEach((e, i) => {
    const base = HEADER_SIZE + ENTRY_SIZE * i
    const s = e.size >= 256 ? 0 : e.size
    buffer.writeUInt8(s, base)
    buffer.writeUInt8(s, base + 1)
    buffer.writeUInt8(0, base + 2)
    buffer.writeUInt8(0, base + 3)
    buffer.writeUInt16LE(1, base + 4)
    buffer.writeUInt16LE(32, base + 6)
    buffer.writeUInt32LE(e.length, base + 8)
    buffer.writeUInt32LE(e.offset, base + 12)
  })

  pngBuffers.forEach((buf, i) => buf.copy(buffer, entries[i].offset))
  return buffer
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🎨 Generating app icons...\n')

  await svgToPng(trayNormalSvg, path.join(assetsDir, 'tray-icon.png'), 22)
  await svgToPng(trayActiveSvg, path.join(assetsDir, 'tray-icon-active.png'), 22)
  await svgToPng(appIconSvg, path.join(assetsDir, 'icon.png'), 512)

  // Windows ICO (16, 32, 48, 64, 128, 256)
  const icoSizes = [16, 32, 48, 64, 128, 256]
  const pngBuffers = await Promise.all(
    icoSizes.map(size => sharp(Buffer.from(appIconSvg)).resize(size, size).png().toBuffer())
  )
  const icoData = buildIco(pngBuffers, icoSizes)
  await fs.promises.writeFile(path.join(assetsDir, 'icon.ico'), icoData)
  console.log(`  ✓ icon.ico (${icoSizes.join(', ')}px)`)

  console.log('\n✅ All icons generated in assets/')
}

main().catch(console.error)
