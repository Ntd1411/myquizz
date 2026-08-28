// Every user-facing error sentence in the app is written HERE. It cannot come from the
// backend any more: the API answers with a bare `error.code` and no prose at all, which
// is exactly what makes the screens translatable.
//
// Two lookups, in this order:
//   1. error.code  the stable machine-readable string the backend sends for every
//                  refusal. See CODE_MESSAGES below.
//   2. status      the coarse fallback for problems that carry no useful detail
//                  anyway: no network, rate limited, server on fire, not allowed.
// Anything else falls through to the sentence the calling screen supplies, because
// only that screen knows what the reader was trying to do.
//
// To translate the app later, this file (plus the fallbacks passed at each call site)
// is the whole surface: swap the values for t('errors.xxx') calls.

// Business failures that share a status code and must NOT share a sentence.
// Keys mirror ERROR_CODES in backend/src/shared/errors/codes.ts one for one; a code
// that is missing here simply falls back to the sentence the screen supplies, so the
// two lists never have to be deployed together.
export const CODE_MESSAGES = {
  // Login and registration
  AUTH_INVALID_CREDENTIALS: 'Incorrect email or password.',
  AUTH_EMAIL_TAKEN: 'That email is already registered.',
  AUTH_PHONE_TAKEN: 'That phone number is already registered.',
  AUTH_GOOGLE_ONLY: 'This account signs in with Google. Use the Google button instead.',
  AUTH_GOOGLE_FAILED: 'Google sign-in did not complete. Please try again.',
  AUTH_GOOGLE_EMAIL_UNVERIFIED:
    'Google has not verified this email address, so it cannot be linked.',

  // Session. The 401 handler in http.js redirects before most of these can be shown,
  // but a failed refresh on a public page still surfaces them.
  AUTH_TOKEN_MISSING: 'Please sign in to continue.',
  AUTH_TOKEN_INVALID: 'Your session has expired. Please sign in again.',
  AUTH_REFRESH_INVALID: 'Your session has expired. Please sign in again.',

  // Account state
  USER_NOT_FOUND: 'That account no longer exists.',
  USER_EMAIL_NOT_FOUND: 'No account uses that email address.',
  USER_DEACTIVATED: 'This account has been deactivated.',
  USER_PASSWORD_INCORRECT: 'Your current password is not correct.',
  USER_NO_FIELDS_TO_UPDATE: 'Change something before saving.',
  ADMIN_CANNOT_BAN_SELF: 'You cannot ban your own account.',

  // Password reset, where several different refusals all arrive as 400
  RESET_OTP_INVALID: 'That code is not correct. Check the digits and try again.',
  RESET_OTP_EXPIRED: 'That code has expired. Request a new one.',
  RESET_OTP_ATTEMPTS: 'Too many wrong codes. Request a new one to continue.',
  RESET_LINK_INVALID: 'This reset link is no longer valid. Request a new one.',
  RESET_TICKET_INVALID: 'This reset session has expired. Start again.',
  RESET_PASSWORD_REUSED: 'Please choose a password you have not used before.',

  // Quizzes
  QUIZ_NOT_FOUND: 'This quiz is no longer available.',
  QUIZ_NO_QUESTIONS: 'A quiz needs at least one question.',
  QUIZ_CURSOR_INVALID: 'This list moved on. Reloading from the first page.',
  QUIZ_AUTH_REQUIRED: 'Please sign in to see your own quizzes.',

  // Rooms and gameplay
  GAME_ROOM_NOT_FOUND: 'No room uses that code.',
  GAME_NOT_HOST: 'Only the host can do this.',
  GAME_LOBBY_ONLY: 'The room settings can only change before the match starts.',
  GAME_ALREADY_STARTED: 'This match has already started.',
  GAME_ROOM_FULL: 'This room is full.',
  GAME_GUESTS_NOT_ALLOWED: 'This room is for signed-in players only.',
  GAME_HOST_CANNOT_JOIN: 'You are hosting this room, so you cannot play in it.',
  GAME_PLAYER_NOT_FOUND: 'You do not have a seat in this room any more.',
  GAME_MODE_UNSUPPORTED: 'That game mode is not available.',
  GAME_TOKEN_INVALID: 'Your seat in this room is no longer valid. Join again.',
  GAME_TOKEN_WRONG_ROOM: 'That seat belongs to a different room.',
  GAME_REVIEW_DISABLED: 'The host turned off answer review for this room.',
  GAME_STILL_RUNNING: 'This match is still running.',

  // Realtime refusals, sent by the /game namespace
  GAME_PLAYER_ONLY: 'Only a player in this room can do that.',
  GAME_NOT_STARTED: 'This match has not started yet.',
  GAME_NOT_ACTIVE: 'This match is not running.',
  GAME_NOT_PAUSED: 'This match is not paused.',
  GAME_PACING_MISMATCH: 'That action does not apply to this game mode.',
  GAME_ADVANCE_NOT_ALLOWED: 'You cannot move to the next question right now.',
  GAME_PLAYER_INACTIVE: 'You are out of this match.',
  GAME_QUESTION_NOT_FOUND: 'There is no question open right now.',
  GAME_QUESTION_LOCKED: 'This question is closed.',
  GAME_ANSWER_REQUIRED: 'Answer the current question before moving on.',
  GAME_ANSWER_DUPLICATE: 'You already answered this question.',
  GAME_ANSWER_TOO_LATE: 'Time is up for this question.',

  // Uploads
  FILE_TOO_LARGE: 'That file is too large.',
  FILE_TYPE_UNSUPPORTED: 'That file type is not supported.',
  FILE_FIELD_INVALID: 'No file was received. Please pick one again.',

  // Cross-cutting. VALIDATION_ERROR should never reach a reader: the forms validate the
  // same rules before sending, so seeing it means the two sides drifted apart.
  VALIDATION_ERROR: 'Please check the highlighted fields and try again.',
  RATE_LIMITED: 'You are making too many requests. Please try again in a few minutes.',
  SERVICE_UNAVAILABLE: 'The server is busy right now. Please try again shortly.',
  SERVER_ERROR: 'The server ran into a problem. Please try again shortly.',
}

// Statuses where the reader gains nothing from knowing which endpoint failed.
export const STATUS_MESSAGES = {
  403: 'You do not have permission to do this.',
  410: 'This account has been deactivated.',
  429: 'You are making too many requests. Please try again in a few minutes.',
}

// Client side socket codes. Server side socket failures reuse the codes above, so only
// the three states the browser decides on its own need their own sentence here.
export const SOCKET_MESSAGES = {
  SOCKET_CLOSED: 'The connection to the room is closed. Please join again.',
  SOCKET_TIMEOUT: 'The server did not answer in time. Please try again.',
  SOCKET_ERROR: 'The connection to the room failed.',
}

export const NETWORK_MESSAGE = 'Could not connect to the server.'
export const SERVER_MESSAGE = 'The server ran into a problem. Please try again shortly.'
export const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

// Socket errors never travel through ApiError, so they get their own lookup: the code
// may be a shared one (GAME_*, SERVER_ERROR) or a browser side socket state.
export const socketErrorMessage = (code, fallback = GENERIC_MESSAGE) =>
  CODE_MESSAGES[code] || SOCKET_MESSAGES[code] || fallback
