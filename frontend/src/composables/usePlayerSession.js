const SESSION_KEY = 'myquizz:player_session'
const ROOMS_KEY = 'myquizz:player_rooms'

/** A room ticket older than this is not worth reusing: the session is long gone. */
const TICKET_TTL_MS = 12 * 60 * 60 * 1000
const MAX_TICKETS = 5

/**
 * Keeps the seat a player got from POST /games/:code/join.
 *
 * Two layers on purpose:
 * - the socket token lives in **sessionStorage**, so one tab is one player and a reload
 *   keeps the exact connection without leaking the seat to other tabs;
 * - a small **localStorage** ticket per room (nickname + ids, never the token) survives
 *   closing the tab. Together with the guest id, also in localStorage, it is enough to
 *   call join again and get the same player row back instead of a duplicate.
 *
 * The token is deliberately not persisted in localStorage: it is a bearer credential for
 * the `/game` namespace, while the ticket only lets this browser ask for a seat it
 * already owns.
 */

function parse(raw) {
  if (!raw) return null

  try {
    const value = JSON.parse(raw)
    return value && typeof value === 'object' ? value : null
  } catch {
    // A corrupted entry is not an error worth showing: the player simply joins again.
    return null
  }
}

function normalizeCode(code) {
  return String(code ?? '').trim().toUpperCase()
}

function readTickets() {
  const stored = parse(window.localStorage.getItem(ROOMS_KEY))
  if (!stored) return {}

  const now = Date.now()
  const fresh = {}
  for (const [code, ticket] of Object.entries(stored)) {
    if (ticket?.savedAt && now - ticket.savedAt < TICKET_TTL_MS) fresh[code] = ticket
  }
  return fresh
}

function writeTickets(tickets) {
  // Keep only the most recent rooms so the entry cannot grow forever.
  const trimmed = Object.entries(tickets)
    .sort(([, a], [, b]) => (b?.savedAt ?? 0) - (a?.savedAt ?? 0))
    .slice(0, MAX_TICKETS)
  window.localStorage.setItem(ROOMS_KEY, JSON.stringify(Object.fromEntries(trimmed)))
}

/**
 * @param {string} [code] when given, the stored seat is only returned for that room
 * @returns {{
 *   code: string, sessionId: number|null, playerId: number|null,
 *   playerName: string, socketToken: string
 * }|null}
 */
export function readPlayerSession(code) {
  const stored = parse(window.sessionStorage.getItem(SESSION_KEY))
  if (!stored?.socketToken) return null
  if (code && stored.code !== normalizeCode(code)) return null
  return stored
}

/** Nickname and ids of the last seat taken in this room, from any tab of this browser. */
export function readRoomTicket(code) {
  const ticket = readTickets()[normalizeCode(code)]
  return ticket ?? null
}

/** Last nickname used anywhere, so the join form does not ask for it twice. */
export function readLastGuestName() {
  const [latest] = Object.values(readTickets()).sort((a, b) => (b?.savedAt ?? 0) - (a?.savedAt ?? 0))
  return latest?.playerName ?? ''
}

export function savePlayerSession({ code, sessionId, playerId, playerName, socketToken }) {
  const roomCode = normalizeCode(code)
  const value = {
    code: roomCode,
    sessionId: sessionId ?? null,
    playerId: playerId ?? null,
    playerName: playerName ?? '',
    socketToken,
  }
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(value))

  const tickets = readTickets()
  tickets[roomCode] = {
    code: roomCode,
    sessionId: value.sessionId,
    playerId: value.playerId,
    playerName: value.playerName,
    savedAt: Date.now(),
  }
  writeTickets(tickets)
  return value
}

export function clearRoomTicket(code) {
  const tickets = readTickets()
  delete tickets[normalizeCode(code)]
  writeTickets(tickets)
}

/**
 * Drops the seat of this tab. Pass the room code to forget the room for good (leaving on
 * purpose); without it the ticket stays and the player can still come back.
 */
export function clearPlayerSession(code) {
  window.sessionStorage.removeItem(SESSION_KEY)
  if (code) clearRoomTicket(code)
}
