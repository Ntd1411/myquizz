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
    // Route params and card ids travel as strings, but the schema wants a real number:
    // `quiz_id: '12'` comes back as a validation error, not as a room.
    quiz_id: Number(quizId),
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

/**
 * Host-only config patch outside the socket connection (page reload, socket down).
 * The server never rejects a bad field: it drops it and reports it in `ignored`,
 * so the caller has to show that list instead of assuming the patch was applied.
 */
export async function updateGameConfig(sessionId, config) {
  const res = await http.patch(`/games/${sessionId}/config`, { config })
  const data = unwrap(res.data)
  return { config: data.config ?? null, changed: data.changed ?? [], ignored: data.ignored ?? [] }
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

/**
 * The player's own answer sheet, once the room is finished. It used to arrive over the
 * socket, but it carries every question with its options, explanation and answer key:
 * that is a document, not room traffic. The socket token is the identity here, and it
 * still works after the room closed, so a reload no longer loses the review.
 */
export async function getGameReview(sessionId, socketToken) {
  const res = await http.get(`/games/${sessionId}/review`, {
    headers: { 'x-socket-token': socketToken },
  })
  return unwrap(res.data).review ?? null
}
