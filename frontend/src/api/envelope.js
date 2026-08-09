// Every REST response from the MyQuizz backend is wrapped in a single envelope:
//   { success, data, error: { message, details }, meta: { timestamp, pagination? } }
// The real payload is ALWAYS under `data`. Never read the axios body directly.

export class ApiError extends Error {
  constructor(message, details = null, status = undefined) {
    super(message)
    this.name = 'ApiError'
    this.details = details
    this.status = status
  }
}

/**
 * Unwraps a backend envelope and returns its `data` payload.
 * Throws an ApiError when the backend reports a failure.
 */
export function unwrap(envelope) {
  if (!envelope || envelope.success !== true || envelope.data === null || envelope.data === undefined) {
    const message = envelope && envelope.error && envelope.error.message
    throw new ApiError(message || 'Unexpected response from server')
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

/**
 * Turns any thrown error (axios or ApiError) into a human readable message.
 */
export function toErrorMessage(error, fallback) {
  const defaultMessage = fallback || 'Da co loi xay ra, vui long thu lai.'
  if (error instanceof ApiError) return error.message
  const backendMessage =
    error && error.response && error.response.data && error.response.data.error
      ? error.response.data.error.message
      : null
  if (backendMessage) return backendMessage
  if (error && error.response && error.response.status === 429) {
    return 'Ban thao tac qua nhanh, vui long thu lai sau it phut.'
  }
  if (error && error.code === 'ERR_NETWORK') return 'Khong ket noi duoc toi may chu.'
  return defaultMessage
}
