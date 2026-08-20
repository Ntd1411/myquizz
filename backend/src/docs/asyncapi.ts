/**
 * The AsyncAPI document for the realtime layer, assembled the same way the
 * OpenAPI one is: plain typed objects, so a typo is a build error.
 *
 * OpenAPI 3.0 can only describe request and response pairs, so the Socket.IO
 * namespace has no place in it. Rather than faking the events as HTTP paths,
 * the gameplay protocol is published as its own document under /v1/docs/socket
 * and the REST reference links to it.
 *
 * Version 2.6 is used on purpose: its `publish` and `subscribe` operations map
 * cleanly onto socket.emit and socket.on, while the 3.x send/receive model adds
 * an indirection that buys nothing for a single namespace.
 */

import { env } from '../infrastructure/config/envconfig.js'
import { socketSchemas } from './components/socket.doc.js'
import { gameChannels } from './socket.channels.js'
import type { OpenApiObject } from './types.js'

/**
 * The socket server is the HTTP server, so the origins are the REST ones minus
 * the /v1 prefix: Socket.IO always connects at the root, on /socket.io.
 */
const developmentServer = {
  url: `localhost:${env.PORT}`,
  protocol: 'ws',
  description: 'Development server. Namespace /game, Socket.IO path /socket.io.'
}

const servers: Record<string, OpenApiObject> = env.API_PUBLIC_URL
  ? {
    production: {
      url: env.API_PUBLIC_URL.replace(/^https?:\/\//, '').replace(/\/v1\/?$/, ''),
      protocol: 'wss',
      description: 'Production server. Namespace /game, Socket.IO path /socket.io.'
    },
    development: developmentServer
  }
  : { development: developmentServer }

/*
 * Introduction page. The AsyncAPI UI renders it as Markdown, like Scalar does
 * for the REST document.
 */
const description = [
  'The gameplay runs on a single Socket.IO namespace, `/game`. The REST API only',
  'creates the room, hands out the tokens and reads the results back; everything',
  'that happens between the start and the last question travels through the',
  'events below.',
  '',
  '## Connecting',
  '',
  'A socket token identifies the room and the seat, and it is the only credential',
  'the namespace reads. Players get one from `POST /games/{code}/join`, hosts from',
  '`POST /games/{id}/host-token`. It is passed in the handshake, never in a query',
  'string:',
  '',
  '```js',
  'const socket = io(`${origin}/game`, {',
  '  auth: {',
  '    token: socketToken',
  '  },',
  '  transports: [',
  '    \'websocket\'',
  '  ]',
  '})',
  '```',
  '',
  'The handshake fails when the token is missing, expired or bound to a match that',
  'is already finished or cancelled. Once it succeeds the socket is already in the',
  'room, and in the host room when the token says so, so `lobby:join` only asks for',
  'the current state.',
  '',
  '## Errors',
  '',
  'A failed handler answers with an error code and nothing else, taken from the',
  'same vocabulary as the REST envelope. When the client sent an acknowledgement',
  'callback it arrives as `{ error: { code } }` in that callback, otherwise as an',
  '`error` event carrying `{ event, code }`. The wording belongs to the client, so',
  'the server never sends a sentence to display.',
  '',
  'A rejected handshake has no payload to fill, so the code travels as the',
  '`connect_error` message itself, for example `GAME_TOKEN_INVALID`.',
  '',
  '`GAME_TOKEN_INVALID`, `GAME_TOKEN_WRONG_ROOM`, `GAME_ROOM_NOT_FOUND` and',
  '`GAME_PLAYER_NOT_FOUND` are fatal: reconnecting with the same token will fail',
  'again, so the client must go back to the join screen instead of retrying.',
  '',
  '## Rules that matter',
  '',
  '- The server is authoritative. Grading, scoring, timers and eliminations happen',
  '  server side; the client only renders what it receives.',
  '- The answer key never reaches a player before the question is closed.',
  '  `question:started` is stripped of `correct_answer`, and the host receives its',
  '  own `host:question` with the key attached.',
  '- Every message carries `serverTime`. Clients keep the offset with their own',
  '  clock and compute the countdowns from `endsAt`, never from a local timer.',
  '- `game:state` is a full snapshot, so a client that reconnects sends',
  '  `player:sync` instead of replaying the events it missed.',
  '- The answer sheet is not an event: it is `GET /games/{id}/review`,',
  '  authenticated by the same socket token.',
  '',
  'The REST reference lives at `/v1/docs`.'
].join('\n')

// Tag order drives the sidebar grouping in the reference UI.
const tags = [
  { name: 'host', description: 'Only the host socket may send it, or only the host room receives it.' },
  { name: 'player', description: 'Only a player socket may send it, or only that player receives it.' },
  { name: 'everyone', description: 'Both roles.' }
]

export const asyncapiSpec: OpenApiObject = {
  asyncapi: '2.6.0',
  id: 'urn:myquizz:game:socket',
  info: {
    title: 'MyQuizz Realtime API',
    version: '1.0.0',
    description,
    contact: {
      name: 'API Support',
      email: 'support@myquizz.com'
    }
  },
  defaultContentType: 'application/json',
  servers,
  tags,
  channels: gameChannels,
  components: { schemas: socketSchemas }
}
