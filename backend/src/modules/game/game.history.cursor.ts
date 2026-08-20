import { AppError } from '../../shared/errors/AppError.js'

/**
 * Cursor codec for GET /games/history.
 *
 * Same shape as quiz/listing.cursor.ts (opaque base64url, version-tagged, every
 * part validated on the way in) but keyed on the one ordering a history list has:
 * the moment a room closed, newest first, with the room id as tie-breaker.
 *
 * The role travels inside the cursor because the two tabs are two different
 * queries: replaying a "played" cursor against the hosted tab would page through
 * unrelated rows, so it is refused instead.
 */

const CURSOR_VERSION = 'v1'
const FIELD_SEPARATOR = '|'

// The two lists a reader can page through: matches they played, rooms they hosted.
export const HISTORY_ROLES = ['played', 'hosted'] as const

export type HistoryRole = (typeof HISTORY_ROLES)[number]

const ROLE_VALUES = new Set<string>(HISTORY_ROLES)

/**
 * Timestamp shape the history repository must emit, via
 * to_char(value at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"').
 * Validation only: the string is passed through untouched so microseconds
 * survive to the SQL cast and two rooms closed in the same second keep a stable
 * order.
 */
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{1,6}Z$/

export interface HistoryCursor {
  role: HistoryRole
  // Ordering value of the last row on the page, kept verbatim as a string.
  endedAt: string
  id: number
}

export function encodeHistoryCursor(cursor: HistoryCursor): string {
  const raw = [CURSOR_VERSION, cursor.role, cursor.endedAt, String(cursor.id)].join(FIELD_SEPARATOR)
  return Buffer.from(raw, 'utf8').toString('base64url')
}

/**
 * Parses a client-supplied cursor, throwing GAME_CURSOR_INVALID (400) on anything
 * that does not belong to the request being served.
 *
 * Buffer.from(..., 'base64url') never throws (it drops invalid characters), so
 * every real check happens on the decoded parts rather than around the decode.
 */
export function decodeHistoryCursor(raw: string, expected: { role: HistoryRole }): HistoryCursor {
  const parts = Buffer.from(raw, 'base64url').toString('utf8').split(FIELD_SEPARATOR)

  if (parts.length !== 4) {
    throw new AppError(400, 'Invalid history cursor', 'GAME_CURSOR_INVALID')
  }

  const [version, role, endedAt, rawId] = parts

  // Under noUncheckedIndexedAccess these read as string | undefined; one empty
  // check both satisfies the type and rejects a cursor with blank fields.
  if (!version || !role || !endedAt || !rawId) {
    throw new AppError(400, 'Invalid history cursor', 'GAME_CURSOR_INVALID')
  }

  if (version !== CURSOR_VERSION) {
    throw new AppError(400, 'Invalid history cursor', 'GAME_CURSOR_INVALID')
  }

  if (!isHistoryRole(role) || role !== expected.role) {
    throw new AppError(400, 'Invalid history cursor', 'GAME_CURSOR_INVALID')
  }

  if (!TIMESTAMP_PATTERN.test(endedAt)) {
    throw new AppError(400, 'Invalid history cursor', 'GAME_CURSOR_INVALID')
  }

  const id = Number(rawId)

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'Invalid history cursor', 'GAME_CURSOR_INVALID')
  }

  return { role, endedAt, id }
}

function isHistoryRole(value: string): value is HistoryRole {
  return ROLE_VALUES.has(value)
}
