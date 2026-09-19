import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const serverMock = vi.hoisted(() => ({
  handler: null as null | ((req: IncomingMessage, res: ServerResponse) => void),
  listen: vi.fn(), on: vi.fn(), close: vi.fn(), closeAllConnections: vi.fn(),
}))

vi.mock('http', () => ({
  default: {
    createServer: vi.fn((handler: typeof serverMock.handler) => { serverMock.handler = handler; return serverMock }),
  },
}))

import { startWebhookServer, stopWebhookServer } from './webhook'

function request(secret: string | undefined = 'secret', event = 'Merge Request Hook') {
  const req = Object.assign(new EventEmitter(), {
    method: 'POST', url: '/webhook', headers: { 'x-gitlab-token': secret, 'x-gitlab-event': event },
    destroyed: false, setTimeout: vi.fn(), destroy: vi.fn(),
  })
  const res = { writeHead: vi.fn(), end: vi.fn() }
  serverMock.handler!(req as unknown as IncomingMessage, res as unknown as ServerResponse)
  return { req, res }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => { stopWebhookServer(); vi.restoreAllMocks() })

describe('webhook request validation', () => {
  test.each(['wrong', 'secrex', ''])('rejects invalid secrets before processing the body: %j', (secret) => {
    const onEvent = vi.fn()
    startWebhookServer(3847, 'secret', onEvent)
    const { req, res } = request(secret)
    req.emit('data', Buffer.from('{}'))
    req.emit('end')
    expect(res.writeHead).toHaveBeenCalledWith(401)
    expect(onEvent).not.toHaveBeenCalled()
  })

  test('binds unauthenticated server only to loopback', () => {
    startWebhookServer(3847, '', vi.fn())
    expect(serverMock.listen).toHaveBeenCalledWith(3847, '127.0.0.1', expect.any(Function))
  })

  test('returns 400 for malformed JSON without dispatching an event', () => {
    const onEvent = vi.fn()
    startWebhookServer(3847, 'secret', onEvent)
    const { req, res } = request()
    req.emit('data', Buffer.from('{broken'))
    req.emit('end')
    expect(res.writeHead).toHaveBeenCalledWith(400)
    expect(onEvent).not.toHaveBeenCalled()
  })

  test('rejects oversized bodies and never dispatches their end event', () => {
    const onEvent = vi.fn()
    startWebhookServer(3847, 'secret', onEvent)
    const { req, res } = request()
    req.emit('data', Buffer.alloc(5 * 1024 * 1024 + 1))
    req.emit('end')
    expect(res.writeHead).toHaveBeenCalledExactlyOnceWith(413)
    expect(req.destroy).toHaveBeenCalledOnce()
    expect(onEvent).not.toHaveBeenCalled()
  })

  test('preserves multibyte text split across chunks and routes MR notes only', () => {
    const onEvent = vi.fn()
    startWebhookServer(3847, 'secret', onEvent)
    const { req, res } = request('secret', 'Note Hook')
    const payload = Buffer.from(JSON.stringify({
      object_attributes: { noteable_type: 'MergeRequest' },
      project: { id: 10 }, merge_request: { id: 7, iid: 2, target_branch: 'ภาษาไทย' },
    }))
    for (const byte of payload) req.emit('data', Buffer.from([byte]))
    req.emit('end')
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'note', projectId: 10, mrIid: 2, targetBranch: 'ภาษาไทย',
    }))
    expect(res.writeHead).toHaveBeenCalledWith(200)

    const issue = request('secret', 'Note Hook')
    issue.req.emit('data', Buffer.from('{"object_attributes":{"noteable_type":"Issue"}}'))
    issue.req.emit('end')
    expect(onEvent).toHaveBeenCalledTimes(1)
  })
})
