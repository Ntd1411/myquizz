// Every REST response from the MyQuizz backend is wrapped in a single envelope:
//   { success, data, error: { code, message, details }, meta: { timestamp, pagination? } }
// The real payload is ALWAYS under `data`. Never read the axios body directly.
//
// `error.message` and `error.details` are for developers: they are English prose and
// zod field dumps, and they must never reach the screen. Only `error.code` and the
// HTTP status cross into the UI, where errors.js turns them into a written sentence.

import {
  CODE_MESSAGES,
  STATUS_MESSAGES,
  NETWORK_MESSAGE,
  SERVER_MESSAGE,
  GENERIC_MESSAGE,
} from './errors'

export class ApiError extends Error {
  constructor(message, code = null, status = undefined) {
    super(message)
    this.name = 'ApiError'
    // Kept for logging and for `instanceof` checks that branch on the kind of
    // failure. `message` is developer text: log it, never render it.
    this.code = code
    this.status = status
  }
}

/**
 * Unwraps a backend envelope and returns its `data` payload.
 * Throws an ApiError when the backend reports a failure.
 */
export function unwrap(envelope) {
  if (!envelope || envelope.success !== true || envelope.data === null || envelope.data === undefined) {
    const error = envelope && envelope.error
    throw new ApiError(
      (error && error.message) || 'Unexpected response from server',
      (error && error.code) || null,
    )
  }
  return envelope.data
}

/**
 * Reads the cursor pagination block every listing endpoint puts under
 * meta.pagination: { limit, nextCursor, hasMore, total? }.
 *
 * `total` only exists when the request asked for it with include_total=true, so it
 * stays undefined instead of being faked as 0.
 * Returns a safe default so callers never have to null-check.
 */
export function readPagination(envelope) {
  const pagination = envelope && envelope.meta ? envelope.meta.pagination : null
  if (!pagination) return { limit: 0, nextCursor: null, hasMore: false }

  return {
    limit: pagination.limit ?? 0,
    nextCursor: pagination.nextCursor ?? null,
    hasMore: Boolean(pagination.hasMore),
    total: pagination.total,
  }
}

/**
 * Cached endpoints (/quizzes/home, /quizzes/feed) report whether the payload came
 * from Redis through meta.cached.
 */
export function readCached(envelope) {
  return Boolean(envelope && envelope.meta && envelope.meta.cached)
}

/** Pulls the backend error code out of either an ApiError or a raw axios error. */
export function toErrorCode(error) {
  if (error instanceof ApiError) return error.code
  return error?.response?.data?.error?.code ?? null
}

/** Pulls the HTTP status out of either an ApiError or a raw axios error. */
export function toErrorStatus(error) {
  if (error instanceof ApiError) return error.status
  return error?.response?.status
}

/**
 * Turns any thrown error into a sentence written by the frontend.
 *
 * @param fallback What the reader was attempting, phrased for them. Used for every
 *   failure that has no code and no generic status meaning - a 400 the client should
 *   have caught, a 404 whose subject only this screen can name. Always pass one.
 */
export function toErrorMessage(error, fallback) {
  const code = toErrorCode(error)
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code]

  // A request that never reached the server has no status at all.
  if (error && (error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED')) {
    return NETWORK_MESSAGE
  }

  const status = toErrorStatus(error)
  if (status && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status]
  if (status && status >= 500) return SERVER_MESSAGE

  return fallback || GENERIC_MESSAGE
}
