import http from 'http'
import os from 'os'
import crypto from 'crypto'

type WebhookPayload = {
  eventType: 'merge_request' | 'pipeline' | 'note'
  mrId: number | null
  action: string | null       // MR: 'open' | 'merge' | 'close' | 'update' | 'reopen' — pipeline: status เช่น 'running' | 'success' | 'failed' — note: 'note'
  authorId: number | null     // object_attributes.author_id
  projectId: number | null    // object_attributes.target_project_id
  mrIid: number | null        // object_attributes.iid
  targetBranch: string | null // object_attributes.target_branch
}

type WebhookCallback = (payload: WebhookPayload) => void

let server: http.Server | null = null

const GITLAB_MR_HOOK = 'Merge Request Hook'
const GITLAB_PIPELINE_HOOK = 'Pipeline Hook'
const GITLAB_NOTE_HOOK = 'Note Hook'

const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024 // 5MB

function getLocalIP(): string {
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return '127.0.0.1'
}

export function getWebhookAddress(port: number, publicUrl?: string): string {
  if (publicUrl && publicUrl.trim()) {
    // Use as-is — caller is expected to provide the full URL including path
    return publicUrl.trim()
  }
  return `http://${getLocalIP()}:${port}/webhook`
}

/** เทียบ secret แบบเวลาคงที่ — กัน timing attack เดา token ทีละไบต์ */
function secretMatches(expected: string, received: unknown): boolean {
  if (typeof received !== 'string') return false
  const a = Buffer.from(expected, 'utf-8')
  const b = Buffer.from(received, 'utf-8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function startWebhookServer(port: number, secret: string, onEvent: WebhookCallback): void {
  stopWebhookServer()

  server = http.createServer((req, res) => {
    // Timeout guard: 10 seconds
    req.setTimeout(10000, () => {
      console.warn('[webhook] request timed out')
      res.writeHead(408)
      res.end('Request Timeout')
      req.destroy()
    })

    if (req.method !== 'POST' || req.url !== '/webhook') {
      res.writeHead(404)
      res.end()
      return
    }

    // Verify secret token if configured
    if (secret && !secretMatches(secret, req.headers['x-gitlab-token'])) {
      console.warn('[webhook] unauthorized attempt')
      res.writeHead(401)
      res.end('Unauthorized')
      return
    }

    const eventType = req.headers['x-gitlab-event'] as string

    // เก็บเป็น Buffer แล้วค่อย decode ทีเดียวตอนจบ — ถ้าต่อ string ทีละ chunk
    // ตัวอักษร UTF-8 หลายไบต์ (เช่นภาษาไทยใน title/description) ที่ถูกตัดคร่อม chunk จะเพี้ยน
    const chunks: Buffer[] = []
    let totalSize = 0
    let aborted = false

    req.on('data', (chunk: Buffer) => {
      if (aborted) return
      totalSize += chunk.length
      if (totalSize > MAX_PAYLOAD_SIZE) {
        aborted = true
        console.warn(`[webhook] payload too large: ${totalSize} bytes`)
        res.writeHead(413)
        res.end('Payload Too Large')
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      if (aborted || req.destroyed) return

      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8'))

        if (eventType === GITLAB_MR_HOOK) {
          const attrs = payload?.object_attributes ?? {}
          onEvent({
            eventType: 'merge_request',
            mrId: attrs.id ?? null,
            action: attrs.action ?? null,
            authorId: attrs.author_id ?? null,
            projectId: attrs.target_project_id ?? null,
            mrIid: attrs.iid ?? null,
            targetBranch: attrs.target_branch ?? null,
          })
        } else if (eventType === GITLAB_PIPELINE_HOOK) {
          const attrs = payload?.object_attributes ?? {}
          const mr = payload?.merge_request ?? {}
          onEvent({
            eventType: 'pipeline',
            mrId: mr.id ?? null,
            action: attrs.status ?? null,
            authorId: null,
            projectId: payload?.project?.id ?? null,
            mrIid: mr.iid ?? null,
            targetBranch: mr.target_branch ?? null,
          })
        } else if (eventType === GITLAB_NOTE_HOOK) {
          // Note Hook ยิงทั้งคอมเมนต์บน MR/issue/commit/snippet — สนใจเฉพาะที่อยู่บน MR
          const attrs = payload?.object_attributes ?? {}
          const mr = payload?.merge_request ?? {}
          if (attrs.noteable_type === 'MergeRequest' && mr.iid) {
            onEvent({
              eventType: 'note',
              mrId: mr.id ?? null,
              action: 'note',
              authorId: null,
              projectId: payload?.project?.id ?? mr.target_project_id ?? null,
              mrIid: mr.iid ?? null,
              targetBranch: mr.target_branch ?? null,
            })
          }
        }

        res.writeHead(200)
        res.end('OK')
      } catch (err) {
        console.error('[webhook] failed to parse payload:', err instanceof Error ? err.message : String(err))
        res.writeHead(400)
        res.end('Bad Request')
      }
    })
  })


  // ไม่มี secret = endpoint ไม่มีการยืนยันตัวตน จึงผูกกับ loopback เท่านั้น
  // ให้เครื่องอื่นในวง LAN ยิงเข้ามา trigger sync รัวๆ ไม่ได้
  const host = secret ? '0.0.0.0' : '127.0.0.1'

  server.listen(port, host, () => {
    console.log(`[webhook] listening on ${host}:${port}/webhook${secret ? '' : ' (loopback only — ยังไม่ได้ตั้ง secret)'}`)
  })

  server.on('error', (err) => {
    console.error('[webhook] server error:', err.message)
  })
}

export function stopWebhookServer(): void {
  if (server) {
    server.closeAllConnections()
    server.close()
    server = null
  }
}
