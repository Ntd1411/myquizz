import jwt from 'jsonwebtoken'
import type { Socket } from 'socket.io'
import * as cache from './game.cache.js'
import * as repo from './game.repository.js'

const SOCKET_SECRET = process.env['SOCKET_JWT_SECRET'] as string
const SOCKET_TOKEN_TTL = '6h'

export interface SocketTokenPayload {
  psid: number | null
  gsid: number
  code: string
  role: 'player' | 'host'
}

export const signSocketToken = (payload: SocketTokenPayload) =>
  jwt.sign(payload, SOCKET_SECRET, { expiresIn: SOCKET_TOKEN_TTL })

export const verifySocketToken = (token: string) =>
  jwt.verify(token, SOCKET_SECRET) as SocketTokenPayload

// middleware: run one time at handshake, results stored in socket.data
export const socketAuth = async (socket: Socket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth?.['token'] as string | undefined
    if (!token) return next(new Error('UNAUTHORIZED: missing socket token'))

    const payload = verifySocketToken(token)   // invalid signature / expired

    // token not expired not means game is still alive -> check state real (cache first, DB after)
    const session = (await cache.getSession(payload.gsid))
      ?? (await repo.getSessionById(payload.gsid))
    if (!session || ['finished', 'cancelled'].includes(session.session_status))
      return next(new Error('GONE: game is not active'))

    if (payload.role === 'player') {
      const player = (await cache.getPlayer(payload.gsid, payload.psid!))
        ?? (await repo.getPlayerSession(payload.psid!))
      // kicked = remove from cache + db -> old token auto expired
      if (!player || player.game_session_id !== payload.gsid)
        return next(new Error('GONE: player not in room'))
      socket.data.player = player
    }

    socket.data.gameId = payload.gsid
    socket.data.code = payload.code
    socket.data.role = payload.role
    socket.data.playerSessionId = payload.psid
    next()
  } catch {
    next(new Error('UNAUTHORIZED: socket token is not valid'))
  }
}