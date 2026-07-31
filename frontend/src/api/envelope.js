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
 * Reads the pagination block that paginated endpoints put under meta.pagination.
 * Returns a safe default so callers never have to null-check.
 */
export function readPagination(envelope) {
  if (envelope && envelope.meta && envelope.meta.pagination) return envelope.meta.pagination
  return {
    page: 1,
    limit: 0,
    total: 0,
    totalPages: 0,
    hasPreviousPage: false,
    hasNextPage: false,
  }
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
