import { io } from 'socket.io-client'

export const GAME_NAMESPACE = '/game'

// Socket.IO is not served under the REST path prefix: VITE_API_BASE_URL may be
// 'http://localhost:3000/api' while the namespace lives on the bare origin.
function apiOrigin() {
  const base = import.meta.env.VITE_API_BASE_URL
  if (!base) return window.location.origin
  return new URL(base, window.location.origin).origin
}

// One socket per tab: the host console and the player screen are different routes,
// so two live connections are never needed at the same time.
let socket = null
let currentToken = null

// The server prefixes every failure with a code, e.g. 'GONE: game is not active'.
// Callers need the code to decide between retry, rejoin and a hard stop.
export function parseSocketError(error) {
  const raw = typeof error === 'string' ? error : error?.message || ''
  const match = /^([A-Z_]+):\s*(.*)$/.exec(raw)
  if (!match) return { code: 'SOCKET_ERROR', message: raw || 'Socket connection failed' }
  return { code: match[1], message: match[2] }
}

// Codes the server will keep rejecting: reconnecting with the same token is pointless.
const FATAL_CODES = ['UNAUTHORIZED', 'FORBIDDEN', 'GONE']

export function isFatalSocketError(error) {
  return FATAL_CODES.includes(parseSocketError(error).code)
}

export function getGameSocket() {
  return socket
}

export function isGameSocketConnected() {
  return Boolean(socket?.connected)
}

/**
 * Opens (or reuses) the /game connection for a socket token.
 * The token carries the room, the role and the player session id, so a different
 * token always means a different identity and the previous socket has to go.
 */
export function connectGameSocket(token) {
  if (!token) throw new Error('connectGameSocket requires a socket token')

  if (socket && currentToken === token) {
    if (!socket.connected) socket.connect()
    return socket
  }

  disconnectGameSocket()
  currentToken = token

  const instance = io(`${apiOrigin()}${GAME_NAMESPACE}`, {
    withCredentials: true,
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  })

  instance.on('connect_error', (error) => {
    const { code, message } = parseSocketError(error)
    console.error(`[socket] connect failed: ${code} - ${message}`)
    // A rejected handshake never becomes valid on its own: stop the retry loop and
    // let the screen decide whether to rejoin the room or leave.
    if (FATAL_CODES.includes(code)) instance.disconnect()
  })

  socket = instance
  return instance
}

/**
 * Replaces the handshake token in place, used after a rejoin returns a fresh one.
 * The socket has to be reopened: the token is only read during the handshake.
 */
export function updateGameSocketToken(token) {
  if (!token || !socket) return connectGameSocket(token)
  if (currentToken === token) return socket
  currentToken = token
  socket.auth = { token }
  socket.disconnect()
  socket.connect()
  return socket
}

export function disconnectGameSocket() {
  if (!socket) return
  socket.removeAllListeners()
  socket.disconnect()
  socket = null
  currentToken = null
}

/** Fire and forget. Returns false when there is no live socket to emit on. */
export function emitGameEvent(event, payload) {
  if (!socket) {
    console.warn(`[socket] dropped ${event}: no active game socket`)
    return false
  }
  if (payload === undefined) socket.emit(event)
  else socket.emit(event, payload)
  return true
}

/**
 * Emits an event that the server answers with an ack.
 * A handler that throws acks `{ error }`, so that shape is rejected as an Error
 * and the caller can read the code with parseSocketError.
 */
export function emitGameEventWithAck(event, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(new Error('SOCKET_CLOSED: no active game socket'))
      return
    }

    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error(`TIMEOUT: ${event} got no ack`))
    }, timeoutMs)

    socket.emit(event, payload ?? {}, (response) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (response?.error) reject(new Error(response.error))
      else resolve(response ?? {})
    })
  })
}
