/**
 * Game session endpoints.
 *
 * Two response shapes are intentionally nested and must stay documented as they
 * are: POST /games returns the session under data.data.session, and
 * GET /games/{id}/results returns everything under data.results.
 *
 * GET /games/{id}/review is the one route identified by the socket token instead
 * of the accessToken cookie: it answers with the caller's own answer sheet, and
 * the token is the only proof the caller is that player.
 *
 * Status codes and error messages are the ones game.controller.ts and
 * game.service.ts actually produce.
 */

import type { OpenApiObject, PathMap, TagObject } from '../types.js'
import {
  arrayOf,
  AUTH_NOTE,
  errorResponse,
  jsonBody,
  object,
  OPTIONAL_AUTH_NOTE,
  ref,
  successExample,
  successResponse,
  validationError
} from '../types.js'

export const gameTag: TagObject = {
  name: 'Game',
  description:
    'The session lifecycle: read the modes, create a room, configure it, let players join, and read the results.'
}

const codeParam: OpenApiObject = {
  in: 'path',
  name: 'code',
  required: true,
  schema: { type: 'string' },
  description: 'Session code shown in the lobby',
  example: 'A1B2C3'
}

const idParam: OpenApiObject = {
  in: 'path',
  name: 'id',
  required: true,
  schema: { type: 'integer', minimum: 1 },
  description: 'Game session id',
  example: 1
}

// Only /games/{id}/review reads it: the caller is a player, not a signed-in user,
// so the seat given out by join is the identity.
const socketTokenHeader: OpenApiObject = {
  in: 'header',
  name: 'x-socket-token',
  required: true,
  schema: { type: 'string' },
  description:
    'Socket token returned by POST /games/{code}/join. A ?token= query parameter is accepted as a fallback for clients that cannot set headers.',
  example:
    'eyJhbGciOiJIUzI1NiJ9.eyJwc2lkIjoxMSwiZ3NpZCI6MSwicm9sZSI6InBsYXllciJ9.REDACTED'
}

// Raised by authMiddleware before the controller runs, on the host-only routes.
const unauthenticated = errorResponse('No usable accessToken cookie', [
  'Access token missing',
  'Token is blacklisted',
  'Invalid access token'
])

const roomNotFound = errorResponse('No session behind that code or id', [
  'Room not found'
])

// Exactly what gameConfigSchema fills in when a host sends nothing.
const exampleConfig = {
  version: 1,
  scoring: {
    basePoints: 1000,
    speedBonus: true,
    streak: { enabled: false, bonusPerStep: 100, max: 500 },
    negativeMarking: false,
    latePenaltyRatio: 0.9
  },
  timing: {
    countdownSeconds: 3,
    // null on purpose: the engine then uses the time_limit of each question.
    perQuestionSeconds: null,
    autoAdvance: true,
    showResultsSeconds: 2,
    totalMatchSeconds: null
  },
  lobby: { maxPlayers: 100, allowLateJoin: false, allowGuests: true },
  flow: {
    pacing: 'host',
    showCorrectAnswer: true,
    showLeaderboard: 'between_questions',
    lives: null,
    allowAnswerLate: false,
    shuffleQuestions: false,
    shuffleOptions: false,
    showHint: false,
    reviewMode: true
  }
}

const exampleSession = {
  id: 1,
  session_code: 'A1B2C3',
  session_name: 'Friday warm-up',
  session_host: 3,
  session_status: 'lobby',
  game_mode: 'classic',
  quiz_snapshot_id: 7,
  total_players: 0,
  total_questions: 8,
  current_question_index: 0,
  current_phase: 'lobby',
  phase_ends_at: null,
  config: exampleConfig
}

export const gamePaths: PathMap = {
  '/games/game-modes': {
    get: {
      summary: 'List game modes',
      description:
        'Returns every registered mode with its default config and the fields a host may edit or that stay locked. Read this before sending a config patch: anything the mode locks is dropped instead of applied.',
      tags: [gameTag.name],
      responses: {
        200: successResponse({
          description: 'Every mode the engine has registered.',
          data: object({ gameModes: arrayOf('ModeConfigDescriptor') }, [
            'gameModes'
          ])
        })
      }
    }
  },

  '/games': {
    post: {
      summary: 'Create a game session',
      description: `Snapshots the quiz, opens a room for it and makes the caller its host. The session is nested under data.data.session, and any config field the mode refused is listed under data.ignored instead of failing the request. mode defaults to classic when omitted. The stored config is not simply the patch you sent: once the surviving fields are merged, the mode rewrites what it owns, so marathon always auto-advances and pins showResultsSeconds to 2, reviewMode forces showCorrectAnswer, perQuestionSeconds 0 disables the speed bonus, self-paced modes downgrade showLeaderboard from between_questions to end_only, and practice zeroes the whole scoring block. Compare data.data.session.config, never your own patch. ${AUTH_NOTE}`,
      tags: [gameTag.name],
      requestBody: jsonBody(
        object(
          {
            quiz_id: {
              type: 'number',
              exclusiveMinimum: 0,
              description:
                'Quiz to snapshot. The schema is z.number().positive(), so it is not narrowed to an integer.'
            },
            session_name: { type: 'string', minLength: 2, maxLength: 100 },
            mode: ref('GameMode'),
            config: ref('GameConfigPatch')
          },
          ['quiz_id', 'session_name']
        ),
        {
          example: {
            quiz_id: 1,
            session_name: 'Friday warm-up',
            mode: 'classic',
            config: {
              scoring: { speedBonus: true },
              timing: { perQuestionSeconds: 30 },
              lobby: { maxPlayers: 50, allowGuests: true },
              flow: { showCorrectAnswer: true, shuffleQuestions: true }
            }
            // config is a patch: every field may be omitted. Only fields the
            // mode marks editable are applied; version, countdownSeconds and
            // basePoints are locked everywhere and would come back in ignored.
          }
        }
      ),
      responses: {
        201: successResponse({
          description:
            'The room is open. data.data.session carries the stored session, data.ignored the config fields the mode refused.',
          data: object(
            {
              data: object({ session: ref('GameSession') }, ['session']),
              ignored: {
                type: 'array',
                description:
                  'Config fields the mode refused, with the reason they were dropped.',
                items: object(
                  {
                    path: { type: 'string' },
                    value: {},
                    reason: {
                      type: 'string',
                      enum: ['unknown', 'locked', 'invalid']
                    }
                  },
                  ['path', 'reason']
                )
              }
            },
            ['data', 'ignored']
          ),
          example: successExample({
            data: { session: exampleSession },
            ignored: [
              {
                path: 'flow.pacing',
                value: 'self',
                reason: 'locked'
              }
            ]
          })
        }),
        400: errorResponse('Rejected payload', [
          validationError({ quiz_id: 'Too small: expected number to be >0' }),
          validationError({
            mode: 'Invalid option: expected one of "classic"|"solo"|"survival"|"marathon"|"practice"'
          })
        ]),
        401: unauthenticated,
        403: errorResponse('The account was deactivated', [
          'Account is deactivated'
        ]),
        404: errorResponse(
          'No quiz behind quiz_id. The snapshot is written before the room, so nothing is created.',
          ['Quiz #1 not found']
        )
      }
    }
  },

  '/games/{code}': {
    get: {
      summary: 'Retrieve a lobby',
      description:
        'Public lobby state for a session code, shaped as data.session = { session, players, config }. This route runs no authentication, and correct answers are never exposed here.',
      tags: [gameTag.name],
      parameters: [codeParam],
      responses: {
        200: successResponse({
          description: 'The room, everybody currently in it, and its config.',
          data: object(
            {
              session: object(
                {
                  session: ref('GameSession'),
                  players: arrayOf('LobbyPlayer'),
                  config: ref('GameConfig')
                },
                ['session', 'players', 'config']
              )
            },
            ['session']
          ),
          example: successExample({
            session: {
              session: exampleSession,
              players: [
                {
                  id: 11,
                  player_name: 'Guest Player',
                  player_score: 0,
                  status: 'connected'
                }
              ],
              config: exampleConfig
            }
          })
        }),
        404: roomNotFound
      }
    }
  },

  '/games/{id}/config': {
    patch: {
      summary: 'Update the game config',
      description: `Only the host may call this, and only while the session is still in the lobby, because the config is part of the room contract. The patch is deep-optional, so omitted fields keep their stored value and even an empty body is accepted, answering with changed false. Fields the mode locks come back under ignored with reason locked, unknown paths with reason unknown, and values outside the range the mode allows with reason invalid, none of which fail the request. The merge is followed by the same mode normalization POST /games describes, so changed compares the stored config with the normalized result rather than with your patch. ${AUTH_NOTE}`,
      tags: [gameTag.name],
      parameters: [idParam],
      requestBody: jsonBody(object({ config: ref('GameConfigPatch') }), {
        example: {
          config: {
            timing: { perQuestionSeconds: 20, autoAdvance: true },
            lobby: { maxPlayers: 30, allowLateJoin: true },
            flow: { showLeaderboard: 'between_questions' }
          }
        }
      }),
      responses: {
        200: successResponse({
          description: 'The stored config after the merge.',
          data: object(
            {
              config: ref('GameConfig'),
              changed: {
                type: 'boolean',
                description:
                  'False when the merge produced the config the room already had.'
              },
              ignored: { type: 'array', items: { type: 'object' } }
            },
            ['config', 'changed', 'ignored']
          ),
          example: successExample({
            config: {
              ...exampleConfig,
              timing: { ...exampleConfig.timing, perQuestionSeconds: 20 },
              lobby: { maxPlayers: 30, allowLateJoin: true, allowGuests: true }
            },
            changed: true,
            ignored: []
          })
        }),
        400: errorResponse('Rejected config patch', [
          validationError({
            'config.lobby.maxPlayers': 'Too big: expected number to be <=500'
          })
        ]),
        401: unauthenticated,
        403: errorResponse('The caller does not host this room', [
          'Only host can update config'
        ]),
        404: roomNotFound,
        409: errorResponse('The match already left the lobby', [
          'Can only update config in lobby'
        ])
      }
    }
  },

  '/games/{id}/host-token': {
    post: {
      summary: 'Create a host token',
      description: `Issues the short-lived socket token the host console needs to drive the match, nested under data.hostToken.socketToken. ${AUTH_NOTE}`,
      tags: [gameTag.name],
      parameters: [idParam],
      responses: {
        200: successResponse({
          description: 'The socket token for the host role.',
          data: object(
            {
              hostToken: object({ socketToken: { type: 'string' } }, [
                'socketToken'
              ])
            },
            ['hostToken']
          ),
          example: successExample({
            hostToken: {
              socketToken:
                'eyJhbGciOiJIUzI1NiJ9.eyJnc2lkIjoxLCJjb2RlIjoiQTFCMkMzIiwicm9sZSI6Imhvc3QifQ.REDACTED'
            }
          })
        }),
        401: unauthenticated,
        403: errorResponse('The caller does not host this room', [
          'Only host can request host token'
        ]),
        404: roomNotFound
      }
    }
  },

  '/games/{code}/join': {
    post: {
      summary: 'Join a game',
      description: `${OPTIONAL_AUTH_NOTE} With a session the identity comes from the token and the body is ignored entirely; without one the client must send player_name and player_guest_id. Rejoining with the same guest id returns the existing player row instead of creating a second one.`,
      tags: [gameTag.name],
      parameters: [codeParam],
      requestBody: jsonBody(
        object(
          {
            player_name: { type: 'string', minLength: 1, maxLength: 50 },
            player_guest_id: { type: 'string', format: 'uuid' }
          },
          ['player_name', 'player_guest_id']
        ),
        {
          required: false,
          description:
            'Required for guests only. Signed-in callers can send an empty body.',
          example: {
            player_name: 'Guest Player',
            player_guest_id: 'b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d'
          }
        }
      ),
      responses: {
        201: successResponse({
          description: 'The player row and its socket token.',
          data: object(
            {
              player: ref('PlayerSession'),
              socketToken: { type: 'string' }
            },
            ['player', 'socketToken']
          ),
          example: successExample({
            player: {
              id: 11,
              game_session_id: 1,
              player_id: null,
              player_guest_id: 'b3f1c2d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
              player_name: 'Guest Player',
              player_score: 0,
              correct_answers_count: 0,
              answered_questions: [],
              streak: 0,
              lives: null,
              current_question_index: 0,
              status: 'connected'
            },
            socketToken:
              'eyJhbGciOiJIUzI1NiJ9.eyJwc2lkIjoxMSwiZ3NpZCI6MSwicm9sZSI6InBsYXllciJ9.REDACTED'
          })
        }),
        400: errorResponse('A guest body that does not validate', [
          validationError({
            player_guest_id: 'Invalid input: expected a UUID'
          })
        ]),
        403: errorResponse('The room refuses this player', [
          'Room does not allow guests',
          'Host can not join game'
        ]),
        404: roomNotFound,
        409: errorResponse('The room cannot take the player right now', [
          'Game already started, no late join allowed',
          'Room is full'
        ])
      }
    }
  },

  '/games/{id}/leaderboard': {
    get: {
      summary: 'Retrieve the leaderboard',
      description:
        'Current standings of a running session, read from Redis while the match is live and from Postgres once it is over. The two paths do not rank identically: the Redis sorted set returns the top 100 players ordered by score alone, while Postgres returns every player ordered by score and then by correct answers. This route runs no authentication.',
      tags: [gameTag.name],
      parameters: [idParam],
      responses: {
        200: successResponse({
          description:
            'Standings, best first. An unknown id answers with an empty array rather than a 404.',
          data: object({ leaderboard: arrayOf('LeaderboardEntry') }, [
            'leaderboard'
          ])
        })
      }
    }
  },

  '/games/{id}/results': {
    get: {
      summary: 'Retrieve the results',
      description:
        'Final standings plus the per-question breakdown, shaped as data.results = { session, leaderboard, perQuestion }. The stats always come from Postgres, never from the cache. This route runs no authentication.',
      tags: [gameTag.name],
      parameters: [idParam],
      responses: {
        200: successResponse({
          description: 'The finished match.',
          data: object(
            {
              results: object(
                {
                  session: ref('GameSession'),
                  leaderboard: arrayOf('LeaderboardEntry'),
                  perQuestion: arrayOf('QuestionStat')
                },
                ['session', 'leaderboard', 'perQuestion']
              )
            },
            ['results']
          )
        }),
        404: roomNotFound
      }
    }
  },

  '/games/{id}/review': {
    get: {
      summary: 'Retrieve my answer sheet',
      description:
        'The caller\'s own review of a finished room: every question of the quiz, in the order that player played it, with the options, the answer key, the explanation, what the player picked and how long it took. Questions the player never submitted come back with answered: false instead of being dropped, so a skipped question is not read as a wrong one. Identity comes from the socket token, never from the accessToken cookie, and the room config must have flow.reviewMode enabled. Answers are only ever revealed here, once the session is finished.',
      tags: [gameTag.name],
      parameters: [idParam, socketTokenHeader],
      responses: {
        200: successResponse({
          description: 'The answer sheet, shaped as data.review.',
          data: object({ review: ref('GameReview') }, ['review'])
        }),
        401: errorResponse('No usable socket token on the request', [
          'Missing socket token',
          'Socket token is not valid'
        ]),
        403: errorResponse('The token cannot ask for this review', [
          'Token belongs to another room',
          'Only a player can review their own answers',
          'Review is disabled in this room'
        ]),
        404: errorResponse('Nothing to review behind that id', [
          'Room not found',
          'Player not found in this room'
        ]),
        409: errorResponse('The room is not over yet', [
          'Game is still running'
        ])
      }
    }
  }
}
