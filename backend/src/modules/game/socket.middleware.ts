import jwt from 'jsonwebtoken'
import type { Socket } from 'socket.io'
import * as cache from './game.cache.js'
import * as repo from './game.repository.js'
import { env } from '../../infrastructure/config/envconfig.js'
import ms from 'ms'

export interface CustomSocketData {
  player?: unknown
  gameId?: number
  code?: string
  role?: 'player' | 'host'
  playerSessionId?: number | null
  userId?: number
}

export interface SocketTokenPayload {
  psid: number | null
  gsid: number
  code: string
  role: 'player' | 'host'
  sv?: number
}

export const signSocketToken = (payload: SocketTokenPayload) => {
  const ttlMs = ms(env.SOCKET_TOKEN_TTL as ms.StringValue)
  if (!Number.isFinite(ttlMs) || ttlMs < 1000 || ttlMs % 1000 !== 0)
    throw new Error('SOCKET_TOKEN_TTL must be a positive whole number of seconds')
  return jwt.sign(payload, env.SOCKET_JWT_SECRET, { expiresIn: ttlMs / 1000 })
}

export const verifySocketToken = (token: string) =>
  jwt.verify(token, env.SOCKET_JWT_SECRET) as SocketTokenPayload

// middleware: run one time at handshake, results stored in socket.data.
// A rejected handshake reaches the browser as an error message, so the message is the
// error code itself: the client turns the code into a sentence in the reader's language.
export const socketAuth = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth?.['token'] as string | undefined
    if (!token) return next(new Error('GAME_TOKEN_INVALID'))

    const payload = verifySocketToken(token) // invalid signature / expired

    // token not expired not means game is still alive -> check state real (cache first, DB after)
    const session = (await cache.getSession(payload.gsid))
      ?? (await repo.getSessionById(payload.gsid))
    if (!session || ['finished', 'cancelled'].includes(session.session_status))
      return next(new Error('GAME_ROOM_NOT_FOUND'))

    const socketData = socket.data as CustomSocketData
    const userId = payload.role === 'host' ? session.session_host : undefined

    if (payload.role === 'player') {
      if (payload.psid === null) return next(new Error('GAME_TOKEN_INVALID'))
      const player = (await cache.getPlayer(payload.gsid, payload.psid))
        ?? (await repo.getPlayerSession(payload.psid))
      // kicked = remove from cache + db -> old token auto expired
      if (!player || player.game_session_id !== payload.gsid)
        return next(new Error('GAME_PLAYER_NOT_FOUND'))
      socketData.player = player
      socketData.userId = player.player_id ?? undefined
    }

    if (userId) socketData.userId = userId
    if (socketData.userId && (await repo.getUserSessionVersion(socketData.userId)) !== payload.sv)
      return next(new Error('USER_DEACTIVATED'))

    socketData.gameId = payload.gsid
    socketData.code = payload.code
    socketData.role = payload.role
    socketData.playerSessionId = payload.psid
    next()
  } catch {
    next(new Error('GAME_TOKEN_INVALID'))
  }
}
