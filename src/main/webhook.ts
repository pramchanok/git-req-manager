import http from 'http'
import os from 'os'

type WebhookCallback = (mrId: number | null) => void

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
    if (req.method !== 'POST' || req.url !== '/webhook') {
      res.writeHead(404)
      res.end()
      return
    }

    // Verify secret token if configured
    const token = req.headers['x-gitlab-token']
    if (secret && token !== secret) {
      res.writeHead(401)
      res.end('Unauthorized')
      return
    }

    const eventType = req.headers['x-gitlab-event'] as string

    let body = ''
    req.on('data', (chunk) => { body += chunk.toString() })
    req.on('end', () => {
      try {
        const payload = JSON.parse(body)

        if (eventType === GITLAB_MR_HOOK) {
          const mrId = payload?.object_attributes?.id ?? null
          onEvent(mrId)
        }

        res.writeHead(200)
        res.end('OK')
      } catch {
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
    server.close()
    server = null
    currentPort = 0
  }
}

export function getWebhookPort(): number {
  return currentPort
}
