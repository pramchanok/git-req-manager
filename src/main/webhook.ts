import http from 'http'
import os from 'os'

type WebhookPayload = {
  mrId: number | null
  action: string | null       // 'open' | 'merge' | 'close' | 'update' | 'reopen'
  authorId: number | null     // object_attributes.author_id
  projectId: number | null    // object_attributes.target_project_id
  mrIid: number | null        // object_attributes.iid
  targetBranch: string | null // object_attributes.target_branch
}

type WebhookCallback = (payload: WebhookPayload) => void

let server: http.Server | null = null
let currentPort = 0

const GITLAB_MR_HOOK = 'Merge Request Hook'

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
    const token = req.headers['x-gitlab-token']
    if (secret && token !== secret) {
      console.warn('[webhook] unauthorized attempt')
      res.writeHead(401)
      res.end('Unauthorized')
      return
    }

    const eventType = req.headers['x-gitlab-event'] as string

    let body = ''
    let totalSize = 0
    const MAX_SIZE = 5 * 1024 * 1024 // 5MB

    req.on('data', (chunk) => {
      totalSize += chunk.length
      if (totalSize > MAX_SIZE) {
        console.warn(`[webhook] payload too large: ${totalSize} bytes`)
        res.writeHead(413)
        res.end('Payload Too Large')
        req.destroy()
        return
      }
      body += chunk.toString()
    })

    req.on('end', () => {
      if (req.destroyed) return

      try {
        const payload = JSON.parse(body)

        if (eventType === GITLAB_MR_HOOK) {
          const attrs = payload?.object_attributes ?? {}
          onEvent({
            mrId: attrs.id ?? null,
            action: attrs.action ?? null,
            authorId: attrs.author_id ?? null,
            projectId: attrs.target_project_id ?? null,
            mrIid: attrs.iid ?? null,
            targetBranch: attrs.target_branch ?? null,
          })
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


  server.listen(port, '0.0.0.0', () => {
    currentPort = port
    console.log(`[webhook] listening on ${getWebhookAddress(port)}`)
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
    currentPort = 0
  }
}

export function getWebhookPort(): number {
  return currentPort
}
