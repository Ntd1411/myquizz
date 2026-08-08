import { AppError } from '../../shared/errors/AppError.js'

/**
 * Keyset position in the feed: the last row the client already received.
 * The feed is ordered by (hot_score desc, id desc), so both parts are needed —
 * `id` breaks ties between quizzes holding the exact same score.
 */
export interface FeedCursor {
  hotScore: number;
  id: number;
}

export function encodeFeedCursor(cursor: FeedCursor): string {
  const raw = `${cursor.hotScore}|${cursor.id}`
  return Buffer.from(raw, 'utf8').toString('base64url')
}

/**
 * Parses a client-supplied cursor, throwing AppError(400) on anything unexpected.
 *
 * Every field is validated rather than trusted: a cursor is user input that
 * reaches a SQL comparison, so a malformed one must fail as a 400 and never as a
 * 500 from the driver. Note that Buffer.from(..., 'base64url') never throws — it
 * silently drops invalid characters — so the real checks have to happen on the
 * decoded parts below, not around the decode call.
 */
export function decodeFeedCursor(raw: string): FeedCursor {
  const decoded = Buffer.from(raw, 'base64url').toString('utf8')
  const parts = decoded.split('|')

  if (parts.length !== 2) {
    throw new AppError(400, 'Invalid feed cursor')
  }

  const [rawScore, rawId] = parts

  if (!rawScore || !rawId) {
    throw new AppError(400, 'Invalid feed cursor')
  }

  const hotScore = Number(rawScore)
  const id = Number(rawId)

  // Number('') is 0 and Number('1e999') is Infinity, so check finiteness, not NaN.
  if (!Number.isFinite(hotScore)) {
    throw new AppError(400, 'Invalid feed cursor')
  }

  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(400, 'Invalid feed cursor')
  }

  return { hotScore, id }
}
