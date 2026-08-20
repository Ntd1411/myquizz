import { io } from 'socket.io-client'
import { socketErrorMessage } from './errors'

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

// A socket failure carries an error code and nothing else: a rejected handshake arrives
// as an Error whose message is the code, an ack arrives as `{ error: { code } }`.
// Callers need the code to decide between retry, rejoin and a hard stop.
export function parseSocketError(error) {
  const raw =
    (typeof error === 'object' && typeof error?.code === 'string' && error.code) ||
    (typeof error === 'string' ? error : error?.message || '')
  const code = raw.trim()
  return { code: /^[A-Z][A-Z_]*$/.test(code) ? code : 'SOCKET_ERROR' }
}

/**
 * The rejection value of every socket failure this module produces.
 *
 * `code` is what callers branch on, and it stays the only thing the server sent.
 * `message` is filled in from the shared code table on the way out, so a screen
 * that only renders `error.message` shows a sentence instead of leaking a raw
 * code like GAME_ANSWER_TOO_LATE. A code with no sentence of its own keeps the
 * generic one, exactly like the REST side.
 */
function socketError(code) {
  const error = new Error(socketErrorMessage(code))
  error.code = code
  return error
}

// Codes the server will keep rejecting: reconnecting with the same token is pointless.
const FATAL_CODES = [
  'GAME_TOKEN_INVALID',
  'GAME_TOKEN_WRONG_ROOM',
  'GAME_ROOM_NOT_FOUND',
  'GAME_PLAYER_NOT_FOUND',
  'GAME_GUESTS_NOT_ALLOWED',
  'GAME_NOT_HOST',
]

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
    const { code } = parseSocketError(error)
    console.error(`[socket] connect failed: ${code}`)
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
 * A handler that throws acks `{ error: { code } }`, so that shape is rejected as an
 * Error carrying both the code, which the caller reads back with parseSocketError,
 * and the ready-to-render sentence for that code.
 */
export function emitGameEventWithAck(event, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (!socket) {
      reject(socketError('SOCKET_CLOSED'))
      return
    }

    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      console.warn(`[socket] ${event} got no ack`)
      reject(socketError('SOCKET_TIMEOUT'))
    }, timeoutMs)

    socket.emit(event, payload ?? {}, (response) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (response?.error) reject(socketError(response.error.code || 'SERVER_ERROR'))
      else resolve(response ?? {})
    })
  })
}
