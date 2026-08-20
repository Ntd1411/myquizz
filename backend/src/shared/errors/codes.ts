/**
 * The full vocabulary of failures this API can report.
 *
 * A code is the ONLY thing an error response carries: no prose, no field dump. The
 * client owns the wording, which is what makes the app translatable, and it means a
 * message can be rewritten here without breaking a single consumer.
 *
 * Rules for adding one:
 *   - Name the situation, not the sentence: GAME_ROOM_FULL, never ROOM_IS_FULL_ERROR.
 *   - Add a code only when a caller could reasonably react differently. Two failures
 *     that always lead to the same screen and the same next step share a code.
 *   - Never remove or rename a shipped code; clients match on it. Add a new one.
 */
export const ERROR_CODES = [
  // Sign in, sign up, sessions
  'AUTH_INVALID_CREDENTIALS',
  'AUTH_EMAIL_TAKEN',
  'AUTH_PHONE_TAKEN',
  'AUTH_TOKEN_MISSING',
  'AUTH_TOKEN_INVALID',
  'AUTH_REFRESH_INVALID',
  'AUTH_GOOGLE_FAILED',
  'AUTH_GOOGLE_EMAIL_UNVERIFIED',
  'AUTH_GOOGLE_ONLY',

  // Accounts
  'USER_NOT_FOUND',
  'USER_EMAIL_NOT_FOUND',
  'USER_DEACTIVATED',
  'USER_PASSWORD_INCORRECT',
  'USER_NO_FIELDS_TO_UPDATE',

  // Password reset, where one status covers many different refusals
  'RESET_OTP_INVALID',
  'RESET_OTP_EXPIRED',
  'RESET_OTP_ATTEMPTS',
  'RESET_LINK_INVALID',
  'RESET_TICKET_INVALID',
  'RESET_PASSWORD_REUSED',

  // Quizzes
  'QUIZ_NOT_FOUND',
  'QUIZ_NO_QUESTIONS',
  'QUIZ_CURSOR_INVALID',
  'QUIZ_AUTH_REQUIRED',

  // Rooms and matches
  'GAME_ROOM_NOT_FOUND',
  'GAME_NOT_HOST',
  'GAME_LOBBY_ONLY',
  'GAME_ALREADY_STARTED',
  'GAME_ROOM_FULL',
  'GAME_GUESTS_NOT_ALLOWED',
  'GAME_HOST_CANNOT_JOIN',
  'GAME_PLAYER_NOT_FOUND',
  'GAME_MODE_UNSUPPORTED',
  'GAME_TOKEN_INVALID',
  'GAME_TOKEN_WRONG_ROOM',
  'GAME_REVIEW_DISABLED',
  'GAME_STILL_RUNNING',

  // Realtime gameplay: refusals a socket handler can answer with, where the client
  // reacts to each one differently (re-render, wait, or send the player back)
  'GAME_PLAYER_ONLY',
  'GAME_NOT_STARTED',
  'GAME_NOT_ACTIVE',
  'GAME_NOT_PAUSED',
  'GAME_PACING_MISMATCH',
  'GAME_ADVANCE_NOT_ALLOWED',
  'GAME_PLAYER_INACTIVE',
  'GAME_QUESTION_NOT_FOUND',
  'GAME_QUESTION_LOCKED',
  'GAME_ANSWER_REQUIRED',
  'GAME_ANSWER_DUPLICATE',
  'GAME_ANSWER_TOO_LATE',

  // Uploads
  'FILE_TOO_LARGE',
  'FILE_TYPE_UNSUPPORTED',
  'FILE_FIELD_INVALID',

  // Cross-cutting
  'VALIDATION_ERROR',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'SERVER_ERROR',

  // Last resort, used when a status carries no more specific meaning. Prefer a real
  // code: these tell the client what happened but not what to say about it.
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'GONE'
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

/**
 * What a status alone means, for errors thrown before anyone picked a code.
 * Every AppError ends up with a code through this table, so a response is never
 * left with nothing for the client to match on.
 */
export const STATUS_FALLBACK_CODES: Record<number, ErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'GONE',
  413: 'FILE_TOO_LARGE',
  429: 'RATE_LIMITED',
  500: 'SERVER_ERROR',
  503: 'SERVICE_UNAVAILABLE'
}

export function codeForStatus(statusCode: number): ErrorCode {
  return STATUS_FALLBACK_CODES[statusCode] ?? 'SERVER_ERROR'
}
