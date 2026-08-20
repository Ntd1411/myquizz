/**
 * The /game namespace, channel by channel.
 *
 * AsyncAPI reads a document from the client point of view: `publish` is what a
 * browser sends to the server, `subscribe` is what it receives. Socket.IO
 * acknowledgements have no place in the 2.x meta-model, so the callbacks are
 * documented with an `x-ack` extension next to the operation that uses one.
 *
 * Channel names are the event names, because Socket.IO routes on the event and
 * not on a topic path.
 */

import { object, ref } from './types.js'
import { serverTime } from './components/socket.doc.js'
import type { OpenApiObject } from './types.js'

// Who may send the event, or who receives it. Drives the sidebar tags.
type Audience = 'host' | 'player' | 'everyone'

const int = (description: string): OpenApiObject => ({ type: 'integer', description })
const str = (description: string): OpenApiObject => ({ type: 'string', description })
const bool = (description: string): OpenApiObject => ({ type: 'boolean', description })
const time = (description: string): OpenApiObject => ({
  type: 'string',
  format: 'date-time',
  description
})
const nullable = (schema: OpenApiObject, type: string): OpenApiObject => ({
  ...schema,
  type: [type, 'null']
})
const listOf = (name: string, description: string): OpenApiObject => ({
  type: 'array',
  items: ref(name),
  description
})

const NO_PAYLOAD: OpenApiObject = {
  type: 'null',
  description: 'No payload: the room, the role and the player are read from the handshake token.'
}

// 'question:answer' -> 'sendQuestionAnswer', so every operationId stays unique.
const operationId = (event: string, direction: 'send' | 'receive'): string =>
  direction + event.replace(/(?:^|[:_-])(\w)/g, (_match, letter: string) => letter.toUpperCase())

const message = (event: string, summary: string, payload: OpenApiObject): OpenApiObject => ({
  name: event,
  title: event,
  summary,
  contentType: 'application/json',
  payload
})

const clientEvent = (args: {
  event: string
  audience: Audience
  summary: string
  description: string
  payload?: OpenApiObject
  ack?: OpenApiObject
}): OpenApiObject => {
  const operation: OpenApiObject = {
    operationId: operationId(args.event, 'send'),
    summary: args.summary,
    tags: [{ name: args.audience }],
    message: message(args.event, args.summary, args.payload ?? NO_PAYLOAD)
  }
  if (args.ack) operation['x-ack'] = args.ack
  return { description: args.description, publish: operation }
}

const serverEvent = (args: {
  event: string
  audience: Audience
  summary: string
  description: string
  payload: OpenApiObject
}): OpenApiObject => ({
  description: args.description,
  subscribe: {
    operationId: operationId(args.event, 'receive'),
    summary: args.summary,
    tags: [{ name: args.audience }],
    message: message(args.event, args.summary, args.payload)
  }
})

export const gameChannels: Record<string, OpenApiObject> = {
  // client -> server
  'lobby:join': clientEvent({
    event: 'lobby:join',
    audience: 'everyone',
    summary: 'Announce the socket in the room',
    description:
      'Sent right after connecting. The socket already belongs to the room at that point, so this only refreshes the roster and replays the current state: lobby:updated for the players, game:state for the host, plus a countdown or a question when the match is already running.'
  }),

  'lobby:leave': clientEvent({
    event: 'lobby:leave',
    audience: 'everyone',
    summary: 'Leave the room',
    description:
      'Marks the player as disconnected and refreshes the roster. The same handler runs on a raw disconnect, so a client that just closes the tab loses nothing.'
  }),

  'lobby:config-update': clientEvent({
    event: 'lobby:config-update',
    audience: 'host',
    summary: 'Patch the room configuration from the lobby',
    description:
      'Host only. A wrapped { config } object and a bare config object are both accepted. The server applies the paths it allows, ignores the locked ones, and broadcasts lobby:updated when something really changed.',
    payload: object({
      config: ref('GameConfig')
    }),
    ack: object({
      ok: bool('Always true when the handler ran.'),
      changed: bool('False when every path in the patch was ignored, in which case nothing is broadcast.'),
      config: ref('GameConfig'),
      ignored: {
        type: 'array',
        items: { type: 'string' },
        description: 'Paths the server refused to take, for example because the match already started.'
      }
    })
  }),

  'game:start': clientEvent({
    event: 'game:start',
    audience: 'host',
    summary: 'Start the match',
    description:
      'Host only, and only from the lobby. Broadcasts game:started, then either the countdown or the first question.'
  }),

  'game:next': clientEvent({
    event: 'game:next',
    audience: 'host',
    summary: 'Move to the next question',
    description:
      'Host only, host-paced rooms. Used when timing.autoAdvance is false, or to cut the results screen short.'
  }),

  'game:pause': clientEvent({
    event: 'game:pause',
    audience: 'host',
    summary: 'Freeze the match',
    description:
      'Host only. The remaining time is stored server side and given back on game:resume, so nobody loses seconds.'
  }),

  'game:resume': clientEvent({
    event: 'game:resume',
    audience: 'host',
    summary: 'Resume a paused match',
    description: 'Host only. Re-arms the frozen timer, whether it was a countdown or an open question.'
  }),

  'game:end': clientEvent({
    event: 'game:end',
    audience: 'host',
    summary: 'End the match now',
    description:
      'Host only. Flushes the players to Postgres and broadcasts game:ended with the final board.'
  }),

  'question:answer': clientEvent({
    event: 'question:answer',
    audience: 'player',
    summary: 'Submit an answer',
    description:
      'Player only, one answer per question. Grading, scoring and the late check all run on the server: the payload carries the choice and nothing else.',
    payload: object(
      {
        answer: {
          description:
            'An option id for multiple_choice, an array of option ids for multiple_select, the typed text for short_answer and long_answer. Option ids can be 0.'
        }
      },
      ['answer']
    ),
    ack: object({
      is_correct: bool('Result of the server-side grading.'),
      score_earned: int('Points added for this answer.'),
      is_late: bool('True when the answer landed after the deadline and was still accepted.'),
      lives: nullable(int('Remaining lives, null outside survival.'), 'integer'),
      serverTime
    })
  }),

  'question:next': clientEvent({
    event: 'question:next',
    audience: 'player',
    summary: 'Ask for the next question',
    description:
      'Self-paced rooms only. The player decides when to move on, and the server answers with question:started, or with player:finished at the end of the sheet.'
  }),

  disconnect: clientEvent({
    event: 'disconnect',
    audience: 'everyone',
    summary: 'The socket dropped',
    description:
      'Built into Socket.IO, listed here because the server reacts to it: the player is marked disconnected and the roster is broadcast, exactly like lobby:leave. The seat is kept, so reconnecting with the same token restores the score and the progress.'
  }),

  'player:sync': clientEvent({
    event: 'player:sync',
    audience: 'everyone',
    summary: 'Ask for a fresh snapshot',
    description:
      'Answered with game:state. Sent after a reconnect or when the tab wakes up, so the client never has to rebuild the state from the events it missed.'
  }),

  // server -> client
  'lobby:updated': serverEvent({
    event: 'lobby:updated',
    audience: 'everyone',
    summary: 'The roster or the configuration changed',
    description:
      'Broadcast whenever a player joins, leaves or reconnects, and after an accepted lobby:config-update.',
    payload: object({
      session_status: str('lobby, active, paused, finished or cancelled.'),
      config: ref('GameConfig'),
      players: listOf('LobbyPlayer', 'Everybody in the room, in join order.'),
      serverTime
    })
  }),

  'game:state': serverEvent({
    event: 'game:state',
    audience: 'everyone',
    summary: 'Full snapshot of the room',
    description:
      'The only event a client needs to render the screen from scratch. Sent on player:sync, on the host screen after a config change, and around pause and resume.',
    payload: ref('GameState')
  }),

  'game:countdown': serverEvent({
    event: 'game:countdown',
    audience: 'everyone',
    summary: 'The match starts in a few seconds',
    description: 'Sent once when the host starts, and again to anyone connecting during the countdown.',
    payload: object({
      seconds: int('Seconds left, already computed against the server clock.'),
      startsAt: nullable(time('When the first question fires.'), 'string'),
      serverTime
    })
  }),

  'game:started': serverEvent({
    event: 'game:started',
    audience: 'everyone',
    summary: 'The match is running',
    description: 'Carries the frozen configuration, so a client that joined the lobby early refreshes it.',
    payload: object({
      mode: str('Game mode of the session.'),
      config: ref('GameConfig'),
      total_questions: int('Questions in the snapshot.'),
      serverTime
    })
  }),

  'question:started': serverEvent({
    event: 'question:started',
    audience: 'everyone',
    summary: 'A question is open',
    description:
      'Broadcast to the room in host-paced rooms, sent to one socket in self-paced ones. The answer key is never part of it: the host gets host:question instead. The self-paced fields below are absent in host-paced rooms.',
    payload: object({
      question: ref('PublicQuestion'),
      time_limit: nullable(int('Seconds allowed, null when the question has no limit.'), 'integer'),
      endsAt: nullable(time('Deadline of this question.'), 'string'),
      matchEndsAt: nullable(time('Self-paced only: marathon deadline for this player.'), 'string'),
      allow_answer_late: bool('Self-paced only: the deadline is soft, keep the inputs enabled.'),
      remainingSeconds: nullable(int('Self-paced only: leftover time after a reconnect, not the full limit.'), 'integer'),
      lives: nullable(int('Self-paced only: remaining lives, so the client never tracks them locally.'), 'integer'),
      serverTime
    })
  }),

  'question:locked': serverEvent({
    event: 'question:locked',
    audience: 'everyone',
    summary: 'The question is closed',
    description: 'Host-paced rooms. Immediately followed by question:results.',
    payload: object({
      index: int('0-based question number.'),
      reason: { type: 'string', enum: ['time_up', 'all_answered'], description: 'Why the question closed.' },
      serverTime
    })
  }),

  'question:results': serverEvent({
    event: 'question:results',
    audience: 'everyone',
    summary: 'Results of the question that just closed',
    description:
      'The correct answer and the distribution are only included when flow.showCorrectAnswer is true, since either of them gives the answer key away.',
    payload: object({
      index: int('0-based question number.'),
      question_id: nullable(int('Snapshot question id.'), 'integer'),
      correct_answer: { description: 'Option ids or accepted text, null while the answer key stays hidden.' },
      stats: ref('AnswerStats'),
      nextQuestionAt: nullable(time('When the next question fires, null when the host advances manually.'), 'string'),
      serverTime
    })
  }),

  'question:awaiting_next': serverEvent({
    event: 'question:awaiting_next',
    audience: 'player',
    summary: 'Waiting for the player to move on',
    description:
      'Self-paced rooms. Sent instead of a new question when the player has to press next, and it carries the result of the previous one.',
    payload: object({
      previous_result: object({
        question_index: int('0-based number of the question just answered.'),
        is_correct: bool('Result of the server-side grading.'),
        score_earned: int('Points added for that answer.'),
        correct_answer: { description: 'Only filled when flow.showCorrectAnswer is true.' }
      }),
      player_score: int('Score so far.'),
      lives: nullable(int('Remaining lives, null outside survival.'), 'integer'),
      serverTime
    })
  }),

  'question:timeout': serverEvent({
    event: 'question:timeout',
    audience: 'player',
    summary: 'The question expired without an answer',
    description: 'Self-paced rooms. The question is counted as wrong and a life is taken in survival.',
    payload: object({
      index: int('0-based question number.'),
      question_id: int('Snapshot question id.'),
      is_correct: bool('Always false.'),
      correct_answer: { description: 'Only filled when the room reveals the answer key.' },
      lives: nullable(int('Remaining lives, null outside survival.'), 'integer'),
      eliminated: bool('True when that timeout knocked the player out.'),
      serverTime
    })
  }),

  'answer:received': serverEvent({
    event: 'answer:received',
    audience: 'everyone',
    summary: 'Somebody answered',
    description:
      'Progress counter for the room. Who answered and whether they were right stays in the host room, so the players only learn how many are done.',
    payload: object({
      index: int('0-based question number.'),
      answered: int('Players who answered this question.'),
      activePlayers: int('Players still expected to answer.'),
      serverTime
    })
  }),

  'host:question': serverEvent({
    event: 'host:question',
    audience: 'host',
    summary: 'The open question, with the answer key',
    description: 'Host room only. The players receive the same question through question:started, stripped of correct_answer.',
    payload: object({
      question: ref('PublicQuestion'),
      correct_answer: { description: 'Option ids or accepted text. Never leaves the host room.' },
      time_limit: nullable(int('Seconds allowed, null when the question has no limit.'), 'integer'),
      endsAt: nullable(time('Deadline of this question.'), 'string'),
      total_questions: int('Questions in the snapshot.'),
      serverTime
    })
  }),

  'host:answer-received': serverEvent({
    event: 'host:answer-received',
    audience: 'host',
    summary: 'One named player answered',
    description: 'Host room only: the counters of answer:received, plus who answered and whether it was right.',
    payload: object({
      index: int('0-based question number.'),
      answered: int('Players who answered this question.'),
      activePlayers: int('Players still expected to answer.'),
      player: object({
        id: int('Player session id.'),
        player_name: str('Display name.')
      }),
      is_correct: bool('Result of the grading. Host room only.'),
      serverTime
    })
  }),

  'host:player-progress': serverEvent({
    event: 'host:player-progress',
    audience: 'host',
    summary: 'A player moved forward',
    description: 'Self-paced rooms: the host screen follows every player one question at a time.',
    payload: object({
      player: object({
        id: int('Player session id.'),
        player_name: str('Display name.'),
        current_question_index: int('Question the player is on.'),
        player_score: int('Score so far.'),
        correct_answers_count: int('Correct answers so far.'),
        status: str('connected, disconnected, eliminated or finished.')
      }),
      total_questions: int('Questions in the snapshot.'),
      serverTime
    })
  }),

  'player:finished': serverEvent({
    event: 'player:finished',
    audience: 'everyone',
    summary: 'A player reached the end of the sheet',
    description:
      'The player receives their own copy with the board attached, empty when flow.showLeaderboard is never. The host copy carries player_name and no board, because the host already gets leaderboard:host.',
    payload: object({
      player: object({
        id: int('Player session id.'),
        player_name: str('Display name. Host copy only.'),
        player_score: int('Final score.'),
        correct_answers_count: int('Correct answers.'),
        status: str('finished, or eliminated when the run ended early.')
      }),
      leaderboard: listOf('LeaderboardRow', 'Player copy only, empty when the board is hidden.'),
      serverTime
    })
  }),

  'player:eliminated': serverEvent({
    event: 'player:eliminated',
    audience: 'everyone',
    summary: 'A player ran out of lives',
    description: 'Survival rooms only.',
    payload: object({
      id: int('Player session id.'),
      player_name: str('Display name.'),
      serverTime
    })
  }),

  'leaderboard:updated': serverEvent({
    event: 'leaderboard:updated',
    audience: 'player',
    summary: 'Standings for the players',
    description:
      'Rank, name and score only, and only when flow.showLeaderboard allows it at that moment. The host room is excluded from this broadcast.',
    payload: object({
      leaderboard: listOf('LeaderboardRow', 'Sorted by score, then by correct answers, then by join order.'),
      serverTime
    })
  }),

  'leaderboard:host': serverEvent({
    event: 'leaderboard:host',
    audience: 'host',
    summary: 'Monitoring table for the host',
    description: 'Host room only, and sent whatever flow.showLeaderboard says: the host always sees everything.',
    payload: object({
      leaderboard: listOf('HostLeaderboardRow', 'Full rows, with per-player counters.'),
      total_questions: int('Questions in the snapshot.'),
      answered_total: int('Answers received in the room so far.'),
      serverTime
    })
  }),

  'game:ended': serverEvent({
    event: 'game:ended',
    audience: 'everyone',
    summary: 'The match is over',
    description:
      'Final board and per-question statistics. The host copy always carries the full board. The same data is readable afterwards through GET /games/{id}/results, and the personal answer sheet through GET /games/{id}/review.',
    payload: object({
      leaderboard: listOf('LeaderboardRow', 'Final standings.'),
      perQuestion: listOf('QuestionStat', 'One row per question, ordered by question_index.'),
      review_enabled: bool('Mirrors flow.reviewMode: whether the answer sheet can be fetched.'),
      serverTime
    })
  }),

  error: serverEvent({
    event: 'error',
    audience: 'everyone',
    summary: 'A client event failed',
    description:
      'Sent only when the failing event carried no acknowledgement callback; otherwise the same code comes back as { error: { code } } in the callback. The payload is a code, never a sentence: the client owns the wording.',
    payload: ref('SocketError')
  })
}
