import { io, Socket } from 'socket.io-client'

type MREventCallback = () => void

let socket: Socket | null = null

export function connectSocketClient(serverUrl: string, onMREvent: MREventCallback): void {
  disconnectSocketClient()

  console.log(`[socket-client] connecting to ${serverUrl}`)

  socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 3000,
    reconnectionAttempts: Infinity,
  })

  socket.on('connect', () => {
    console.log(`[socket-client] connected to ${serverUrl}`)
  })

  socket.on('gitlab:mr-event', (data: unknown) => {
    console.log('[socket-client] gitlab:mr-event received:', data)
    onMREvent()
  })

  socket.on('disconnect', (reason) => {
    console.log(`[socket-client] disconnected: ${reason}`)
  })

  socket.on('connect_error', (err) => {
    console.error(`[socket-client] connection error: ${err.message}`)
  })
}

export function disconnectSocketClient(): void {
  if (socket) {
    socket.disconnect()
    socket = null
    console.log('[socket-client] disconnected and cleaned up')
  }
}

/** แปลง full webhook URL เป็น socket.io server base URL
 * เช่น https://ig-server-eoffice.igenco.dev/gitlab-webhook → https://ig-server-eoffice.igenco.dev
 */
export function extractServerUrl(webhookPublicUrl: string): string | null {
  try {
    const parsed = new URL(webhookPublicUrl.trim())
    return parsed.origin
  } catch {
    return null
  }
}
