import fs from 'fs'
import net from 'net'
import os from 'os'
import path from 'path'

const singleInstanceChannelPath = process.platform === 'win32'
  ? '\\\\.\\pipe\\gitlab-mr-manager-single-instance'
  : path.join(os.tmpdir(), 'gitlab-mr-manager-single-instance.sock')
const singleInstanceLockPath = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA ?? os.tmpdir(), 'GitLab MR Manager', 'single-instance.lock')
  : path.join(os.tmpdir(), 'gitlab-mr-manager-single-instance.lock')

let secondInstanceHandler: (() => void) | null = null
let singleInstanceServer: net.Server | null = null
let singleInstanceLockFd: number | null = null

function isProcessRunning(processId: number): boolean {
  try {
    process.kill(processId, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function releaseSingleInstanceLock(): void {
  if (singleInstanceLockFd !== null) {
    fs.closeSync(singleInstanceLockFd)
    singleInstanceLockFd = null
  }

  fs.rmSync(singleInstanceLockPath, { force: true })
}

function tryAcquireSingleInstanceLock(hasRetried = false): boolean {
  fs.mkdirSync(path.dirname(singleInstanceLockPath), { recursive: true })

  try {
    const fd = fs.openSync(singleInstanceLockPath, 'wx')
    fs.writeFileSync(fd, `${process.pid}`)
    singleInstanceLockFd = fd
    return true
  } catch (error) {
    const lockError = error as NodeJS.ErrnoException
    if (lockError.code !== 'EEXIST') {
      console.error('[single-instance] failed to create lock file:', lockError)
      return false
    }
  }

  const existingPid = Number.parseInt(fs.readFileSync(singleInstanceLockPath, 'utf8').trim(), 10)
  if (Number.isInteger(existingPid) && isProcessRunning(existingPid)) {
    return false
  }

  if (hasRetried) {
    console.error('[single-instance] stale lock file could not be recovered')
    return false
  }

  fs.rmSync(singleInstanceLockPath, { force: true })
  return tryAcquireSingleInstanceLock(true)
}

function notifyPrimaryInstance(): Promise<boolean> {
  return new Promise((resolve) => {
    const client = net.createConnection(singleInstanceChannelPath, () => {
      client.end()
      resolve(true)
    })

    client.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code && error.code !== 'ENOENT' && error.code !== 'ECONNREFUSED') {
        console.error('[single-instance] failed to contact primary instance:', error)
      }

      resolve(false)
    })
  })
}

function startServer(): void {
  const server = net.createServer((socket) => {
    secondInstanceHandler?.()
    socket.end()
  })

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE' && process.platform !== 'win32') {
      fs.rmSync(singleInstanceChannelPath, { force: true })
      server.listen(singleInstanceChannelPath)
      return
    }

    console.error('[single-instance] failed to listen for second-instance requests:', error)
  })

  if (process.platform === 'win32') {
    server.listen({
      path: singleInstanceChannelPath,
      readableAll: true,
      writableAll: true,
    })
  } else {
    server.listen(singleInstanceChannelPath)
  }

  singleInstanceServer = server
}

export async function acquireSingleInstanceChannel(): Promise<boolean> {
  if (!tryAcquireSingleInstanceLock()) {
    await notifyPrimaryInstance()
    return false
  }

  startServer()
  return true
}

export function setSecondInstanceHandler(handler: () => void): void {
  secondInstanceHandler = handler
}

export async function cleanupSingleInstanceChannel(): Promise<void> {
  if (!singleInstanceServer) {
    releaseSingleInstanceLock()
    if (process.platform !== 'win32') fs.rmSync(singleInstanceChannelPath, { force: true })
    return
  }

  const server = singleInstanceServer
  singleInstanceServer = null

  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve()
    })
  })

  releaseSingleInstanceLock()
  if (process.platform !== 'win32') fs.rmSync(singleInstanceChannelPath, { force: true })
}
