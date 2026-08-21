/**
 * The OpenAPI document, assembled from the component and path modules.
 *
 * The spec is a plain object built at import time instead of being scanned out
 * of JSDoc comments, so a typo is a build error rather than a silently missing
 * endpoint, and the routes stay free of documentation noise.
 *
 * There is no components.securitySchemes on purpose. Authentication is an
 * HttpOnly cookie the browser sends by itself, so declaring a cookie scheme
 * would only make the reference UI render an editable Cookie field that the
 * caller must not fill in.
 */

import { env } from '../infrastructure/config/envconfig.js'
import type { OpenApiObject, SchemaMap, PathMap, TagObject } from './types.js'
import { envelopeSchemas } from './components/envelope.doc.js'
import { userSchemas } from './components/user.doc.js'
import { quizSchemas } from './components/quiz.doc.js'
import { gameSchemas } from './components/game.doc.js'
import { storageSchemas } from './components/storage.doc.js'
import { authPaths, authTag } from './paths/auth.path.js'
import { userPaths, userTag } from './paths/user.path.js'
import { quizPaths, quizTag } from './paths/quiz.path.js'
import { gamePaths, gameTag } from './paths/game.path.js'
import { storagePaths, storageTag } from './paths/storage.path.js'

/**
 * Routes are mounted under /v1, so every documented path is relative to it.
 *
 * The reference lets the reader pick a server from this list and sends the
 * test requests there, so the production entry is listed first whenever
 * API_PUBLIC_URL is set: on a deployed instance the docs then target the
 * deployment, and only fall back to localhost while developing. Nothing is
 * hard-coded, changing the environment variable is enough.
 */
const developmentServer = {
  url: `http://localhost:${env.PORT}/v1`,
  description: 'Development server'
}

const servers = env.API_PUBLIC_URL
  ? [
    { url: env.API_PUBLIC_URL, description: 'Production server' },
    developmentServer
  ]
  : [developmentServer]

// Tag order drives the sidebar order in the reference UI.
const tags: TagObject[] = [authTag, userTag, quizTag, gameTag, storageTag]

const schemas: SchemaMap = {
  ...envelopeSchemas,
  ...userSchemas,
  ...quizSchemas,
  ...gameSchemas,
  ...storageSchemas
}

const paths: PathMap = {
  ...authPaths,
  ...userPaths,
  ...quizPaths,
  ...gamePaths,
  ...storagePaths
}

/*
 * Introduction page. Scalar renders this as Markdown, so the fenced blocks are
 * written the way they should be read: one JSON key per line, never collapsed
 * onto a single line.
 */
const description = [
  'MyQuizz is a realtime quiz game: an author writes a quiz, a host opens a',
  'session for it, players join with a session code, and the match is driven',
  'over websockets while the scores are read back through this API.',
  '',
  '## Conventions',
  '',
  'Every endpoint answers with the same envelope, so a client can always read',
  '`success` first and branch on it:',
  '',
  '```json',
  '{',
  '  "success": true,',
  '  "data": {',
  '    "quiz": {}',
  '  },',
  '  "error": null,',
  '  "meta": {',
  '    "timestamp": "2026-08-12T03:00:00.000Z"',
  '  }',
  '}',
  '```',
  '',
  'A failure keeps the shape and carries a single machine-readable `error.code`.',
  'There is deliberately no message and no field-level detail: the wording a',
  'reader sees belongs to the client, which owns the language it renders in, and',
  'the rejected fields are already known to the form that submitted them. Every',
  'field-level refusal collapses into `VALIDATION_ERROR`, so a client that keeps',
  'its own validation in sync never has to show it:',
  '',
  '```json',
  '{',
  '  "success": false,',
  '  "data": null,',
  '  "error": {',
  '    "code": "VALIDATION_ERROR"',
  '  },',
  '  "meta": {',
  '    "timestamp": "2026-08-12T03:00:00.000Z"',
  '  }',
  '}',
  '```',
  '',
  '## Error codes',
  '',
  '`error.code` is the whole contract of a failure, so four rules follow from',
  'it:',
  '',
  '1. Match on the code, never on the status and never on prose. The status',
  '   only says which family a refusal belongs to; the code says what happened.',
  '2. Treat an unknown code as a generic failure and show your own fallback',
  '   sentence. Codes are added over time, and a shipped code is never renamed',
  '   or removed.',
  '3. `VALIDATION_ERROR` means the body was rejected by a schema before the',
  '   handler ran. A client that validates the same shapes should never have to',
  '   show it to a reader.',
  '4. The internal error message is written to the server log only. It is never',
  '   part of a response and can be reworded at any time, which is exactly why',
  '   it must not be matched on.',
  '',
  'When a throw carries no explicit code, the status decides the last-resort',
  'code that is sent instead:',
  '',
  '| Status | Last-resort code |',
  '| --- | --- |',
  '| 400 | `BAD_REQUEST` |',
  '| 401 | `UNAUTHORIZED` |',
  '| 403 | `FORBIDDEN` |',
  '| 404 | `NOT_FOUND` |',
  '| 409 | `CONFLICT` |',
  '| 410 | `GONE` |',
  '| 413 | `FILE_TOO_LARGE` |',
  '| 429 | `RATE_LIMITED` |',
  '| 500 | `SERVER_ERROR` |',
  '| 503 | `SERVICE_UNAVAILABLE` |',
  '',
  'Those six generic codes are a safety net, not an interface: a client cannot',
  'react usefully to them, so seeing one means the throw site still owes a real',
  'code and is worth reporting.',
  '',
  '### Authentication and sessions',
  '',
  '| Code | Situation |',
  '| --- | --- |',
  '| `AUTH_INVALID_CREDENTIALS` | Unknown email, or a password that does not match. |',
  '| `AUTH_EMAIL_TAKEN` | The email is already registered. |',
  '| `AUTH_PHONE_TAKEN` | The phone number belongs to another account. |',
  '| `AUTH_TOKEN_MISSING` | No `accessToken` cookie was sent. |',
  '| `AUTH_TOKEN_INVALID` | The access token does not verify, or was revoked by a logout. |',
  '| `AUTH_REFRESH_INVALID` | The refresh token is missing, already rotated, or does not verify. |',
  '| `AUTH_GOOGLE_FAILED` | The Google exchange failed: refused consent, a bad state, or a profile that cannot be read. |',
  '| `AUTH_GOOGLE_EMAIL_UNVERIFIED` | Google has not verified that email, so it cannot be linked. |',
  '| `AUTH_GOOGLE_ONLY` | The account has no password because it was created through Google. |',
  '',
  '### Accounts',
  '',
  '| Code | Situation |',
  '| --- | --- |',
  '| `USER_NOT_FOUND` | No account behind that id, token or ticket. |',
  '| `USER_EMAIL_NOT_FOUND` | No account uses that email. |',
  '| `USER_DEACTIVATED` | The account exists but was deactivated. |',
  '| `USER_PASSWORD_INCORRECT` | The password sent to confirm the action is wrong. |',
  '| `USER_NO_FIELDS_TO_UPDATE` | The patch carries nothing that can be written. |',
  '',
  '### Password reset',
  '',
  '| Code | Situation |',
  '| --- | --- |',
  '| `RESET_OTP_INVALID` | The six digits do not match the outstanding code. |',
  '| `RESET_OTP_EXPIRED` | The code expired or was never issued. |',
  '| `RESET_OTP_ATTEMPTS` | Too many wrong codes; the code was deleted and a new email is required. |',
  '| `RESET_LINK_INVALID` | The link token expired or does not verify. |',
  '| `RESET_TICKET_INVALID` | The reset ticket is missing, expired, or already spent. |',
  '| `RESET_PASSWORD_REUSED` | The new password is the current one. |',
  '',
  '### Quizzes',
  '',
  '| Code | Situation |',
  '| --- | --- |',
  '| `QUIZ_NOT_FOUND` | No such quiz, or a private one the caller does not own. Ownership failures answer 404 on purpose. |',
  '| `QUIZ_NO_QUESTIONS` | The quiz would be left without a single question. |',
  '| `QUIZ_CURSOR_INVALID` | The cursor does not decode, or no longer matches the sort and filters of the request. |',
  '| `QUIZ_AUTH_REQUIRED` | The listing was asked for the caller own quizzes without a session. |',
  '',
  '### Rooms over HTTP',
  '',
  '| Code | Situation |',
  '| --- | --- |',
  '| `GAME_ROOM_NOT_FOUND` | No session behind that code or id. |',
  '| `GAME_NOT_HOST` | The caller does not host this room. |',
  '| `GAME_LOBBY_ONLY` | The match already left the lobby. |',
  '| `GAME_ALREADY_STARTED` | Late joins are not allowed once the match runs. |',
  '| `GAME_ROOM_FULL` | The lobby reached `maxPlayers`. |',
  '| `GAME_GUESTS_NOT_ALLOWED` | The room requires a signed-in player. |',
  '| `GAME_HOST_CANNOT_JOIN` | The host cannot also play. |',
  '| `GAME_PLAYER_NOT_FOUND` | No such player in this room. |',
  '| `GAME_MODE_UNSUPPORTED` | The requested game mode is not implemented. |',
  '| `GAME_TOKEN_INVALID` | The socket token is missing or does not verify. |',
  '| `GAME_TOKEN_WRONG_ROOM` | The socket token belongs to another room. |',
  '| `GAME_REVIEW_DISABLED` | The host turned the answer review off. |',
  '| `GAME_STILL_RUNNING` | The result is only available once the match is over. |',
  '',
  '### Play history',
  '',
  'The history routes read matches that are already over, so they identify the',
  'reader by cookie when there is one and by the `x-guest-id` header otherwise.',
  'A guest therefore keeps a readable history without an account, and the four',
  'codes below are the ones only these routes answer with.',
  '',
  '| Code | Situation |',
  '| --- | --- |',
  '| `GAME_AUTH_REQUIRED` | Neither a session nor an `x-guest-id` header was sent, or `role=hosted` was asked for without an account. |',
  '| `GAME_CURSOR_INVALID` | The cursor does not decode, or it was issued for the other `role`. |',
  '| `GAME_FORBIDDEN` | The match exists, but the reader neither hosted it nor held a seat in it. |',
  '| `GAME_PLAYER_ONLY` | An answer sheet was asked for by somebody who never played that match, a host included. |',
  '| `GONE` | The match was soft deleted. |',
  '',
  'A match that has not ended yet answers `GAME_STILL_RUNNING`, and an id behind',
  'no match at all `GAME_ROOM_NOT_FOUND`, exactly as the room routes above do.',
  '',
  '### Uploads',
  '',
  '| Code | Situation |',
  '| --- | --- |',
  '| `FILE_TOO_LARGE` | The file is over the 2MB limit. |',
  '| `FILE_TYPE_UNSUPPORTED` | The content type is not an allowed image type. |',
  '| `FILE_FIELD_INVALID` | No file was sent, the field name is unexpected, or the target folder is not allowed. |',
  '',
  '### Cross-cutting',
  '',
  '| Code | Situation |',
  '| --- | --- |',
  '| `VALIDATION_ERROR` | The body was rejected by its schema. |',
  '| `RATE_LIMITED` | A rate limiter refused the call; `Retry-After` says when to try again. |',
  '| `SERVICE_UNAVAILABLE` | A dependency the request needs is unreachable. |',
  '| `SERVER_ERROR` | The request reached the server and something went wrong there. |',
  '',
  'The realtime side speaks the same vocabulary and adds the in-match codes',
  '(answering while a question is locked, acting outside the active phase, and',
  'so on). They are documented in [the realtime API](/v1/docs/socket), and a',
  'client can reuse one code-to-sentence table for both transports.',
  '',
  '## Pagination',
  '',
  'Listing endpoints are keyset paginated and report their state under',
  '`meta.pagination`. Copy `nextCursor` into the `cursor` query parameter to',
  'get the following page, and stop when `hasMore` is false. A cursor is bound',
  'to the sort and filters that produced it, so changing any of them while',
  'paginating is a 400 rather than a page from another result set. `total` is',
  'only computed when the request asks for it with `include_total=true`. The',
  'play history binds its cursor to `role` the same way, so a cursor from the',
  'played tab cannot page the hosted one.',
  '',
  '## Authentication',
  '',
  'There is no API key and no Authorize button. Sign in through',
  '`POST /auth/login` (or the Google routes) and the server sets HttpOnly',
  '`accessToken` and `refreshToken` cookies that the browser replays on every',
  'following call, including the requests you send from this page. Because the',
  'cookies are HttpOnly, there is nothing to paste into the request editor.',
  'When the access token expires, call `POST /auth/refresh` to rotate it.',
  '',
  '## Trying it out',
  '',
  'Each operation ships a filled-in example body, so "Test Request" sends a',
  'payload that already works against a seeded development database; adjust the',
  'ids to match your own data. Uploads are two steps: ask',
  '`POST /storage/presign` for a URL, `PUT` the binary straight to object',
  'storage, then send the returned `publicUrl` to the endpoint that stores it.',
  '',
  '## Realtime',
  '',
  'The gameplay itself runs over Socket.IO and cannot be described by OpenAPI,',
  'so it has its own reference: [the realtime API](/v1/docs/socket), written as',
  'an AsyncAPI document and served next to this one. The HTTP endpoints only',
  'create the room, hand out socket tokens and read the results back.'
].join('\n')

export const openapiSpec: OpenApiObject = {
  openapi: '3.0.3',
  info: {
    title: 'MyQuizz API',
    version: '1.0.0',
    description,
    contact: {
      name: 'API Support',
      email: 'support@myquizz.com'
    }
  },
  servers,
  tags,
  components: { schemas },
  paths
}
