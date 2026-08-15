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
  'A failure keeps the shape and moves the wording into `error.message`, which',
  'is always the exact sentence thrown by the service. `error.details` is null',
  'except on a validation failure, where it maps each rejected field to its',
  'reason:',
  '',
  '```json',
  '{',
  '  "success": false,',
  '  "data": null,',
  '  "error": {',
  '    "message": "Validation error",',
  '    "details": {',
  '      "email": "Invalid email"',
  '    }',
  '  },',
  '  "meta": {',
  '    "timestamp": "2026-08-12T03:00:00.000Z"',
  '  }',
  '}',
  '```',
  '',
  '## Pagination',
  '',
  'Listing endpoints are keyset paginated and report their state under',
  '`meta.pagination`. Copy `nextCursor` into the `cursor` query parameter to',
  'get the following page, and stop when `hasMore` is false. A cursor is bound',
  'to the sort and filters that produced it, so changing any of them while',
  'paginating is a 400 rather than a page from another result set. `total` is',
  'only computed when the request asks for it with `include_total=true`.',
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
