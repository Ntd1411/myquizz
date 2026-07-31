import { http } from './http'
import { unwrap } from './envelope'

/**
 * Game session endpoints (backend module `game`).
 *
 * Note the nesting the backend uses:
 *   POST   /games            -> data.data.session, data.ignored
 *   GET    /games/:code      -> data.session = { session, players, config }
 *   POST   /games/:code/join -> data.player, data.socketToken
 */

export async function listGameModes() {
  const res = await http.get('/games/game-modes')
  return unwrap(res.data).gameModes ?? []
}

export async function createGame({ quizId, sessionName, mode, config }) {
  const res = await http.post('/games', {
    quiz_id: quizId,
    session_name: sessionName,
    mode: mode || undefined,
    config: config || undefined,
  })
  const data = unwrap(res.data)
  return { session: data.data?.session ?? null, ignored: data.ignored ?? [] }
}

/** Public lobby state for a room code. Answers are never included. */
export async function getGameByCode(code) {
  const res = await http.get(`/games/${encodeURIComponent(code)}`)
  const payload = unwrap(res.data).session ?? {}
  return {
    session: payload.session ?? null,
    players: payload.players ?? [],
    config: payload.config ?? null,
  }
}

/**
 * Joins a room. Optional auth: with a session cookie the backend takes the identity
 * from the token and ignores the body, so the guest fields are only sent when needed.
 */
export async function joinGame(code, { playerName, guestId } = {}) {
  const body = playerName && guestId ? { player_name: playerName, player_guest_id: guestId } : {}
  const res = await http.post(`/games/${encodeURIComponent(code)}/join`, body)
  const data = unwrap(res.data)
  return { player: data.player ?? null, socketToken: data.socketToken ?? null }
}

export async function getHostToken(sessionId) {
  const res = await http.post(`/games/${sessionId}/host-token`)
  return unwrap(res.data).hostToken?.socketToken ?? null
}

export async function getLeaderboard(sessionId) {
  const res = await http.get(`/games/${sessionId}/leaderboard`)
  return unwrap(res.data).leaderboard ?? []
}

export async function getResults(sessionId) {
  const res = await http.get(`/games/${sessionId}/results`)
  return unwrap(res.data).results ?? null
}
