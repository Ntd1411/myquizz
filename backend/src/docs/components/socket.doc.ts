/**
 * Schemas for the realtime messages, shared by the AsyncAPI channels.
 *
 * Every shape mirrors a payload builder in modules/game/game.socket.ts
 * (publicQuestion, publicPlayer, emitLobby, buildLeaderboard, snapshot), so the
 * document describes what the namespace really sends instead of an idealised
 * contract.
 *
 * AsyncAPI 2.6 validates payloads with JSON Schema draft 7, which has no
 * `nullable` keyword: a field that can be null is typed as a union instead.
 */

import { object, ref } from '../types.js'
import type { OpenApiObject, SchemaMap } from '../types.js'

const int = (description: string): OpenApiObject => ({ type: 'integer', description })
const str = (description: string): OpenApiObject => ({ type: 'string', description })
const bool = (description: string): OpenApiObject => ({ type: 'boolean', description })
const time = (description: string): OpenApiObject => ({
  type: 'string',
  format: 'date-time',
  description
})

// draft 7 union, used wherever the server can legitimately send null
const nullable = (schema: OpenApiObject, type: string): OpenApiObject => ({
  ...schema,
  type: [type, 'null']
})

/** Shared by every message: the clock the client aligns itself on. */
export const serverTime = time('Server clock when the message was built. Clients keep the offset instead of trusting their own clock.')

export const socketSchemas: SchemaMap = {
  GameConfig: {
    type: 'object',
    description:
      'Room configuration, the same object as GameSession.config in the REST reference: flow, lobby, timing and scoring.',
    additionalProperties: true
  },

  AnswerOption: {
    type: 'object',
    description:
      'One option from the quiz snapshot. Grading matches on id, so the display order can be shuffled per player without touching the score.',
    properties: {
      id: { description: 'Option id, unique inside the question. It can be 0, so never test it for truthiness.' },
      text: nullable(str('Option label.'), 'string'),
      image: nullable(str('Option image URL.'), 'string')
    },
    additionalProperties: true
  },

  PublicQuestion: object(
    {
      index: int('0-based position in the question list.'),
      total: int('Number of questions in the snapshot.'),
      id: int('Snapshot question id.'),
      question_type: str('multiple_choice, multiple_select, short_answer or long_answer.'),
      question_text: str('Question wording.'),
      question_image: nullable(str('Illustration URL.'), 'string'),
      question_hint: nullable(str('Only filled when flow.showHint is true.'), 'string'),
      answer_options: nullable(
        {
          type: 'array',
          items: ref('AnswerOption'),
          description: 'Reordered per player when flow.shuffleOptions is true.'
        },
        'array'
      )
    },
    ['index', 'total', 'id', 'question_type', 'question_text']
  ),

  LobbyPlayer: object({
    id: int('Player session id.'),
    player_name: str('Display name.'),
    player_score: int('Score so far.'),
    player_avatar: nullable(str('Avatar URL, null when the player never picked one.'), 'string'),
    lives: nullable(int('Remaining lives, null outside survival.'), 'integer'),
    status: str('connected, disconnected, eliminated or finished.')
  }),

  LeaderboardRow: object({
    rank: int('1-based position.'),
    id: int('Player session id.'),
    player_name: str('Display name.'),
    player_score: int('Score.')
  }),

  HostLeaderboardRow: object({
    rank: int('1-based position.'),
    id: int('Player session id.'),
    player_name: str('Display name.'),
    player_score: int('Score.'),
    answered_count: int('Questions the player answered.'),
    correct_count: int('Correct answers.'),
    wrong_count: int('Wrong answers.'),
    unanswered_count: int('Questions left untouched.'),
    total_questions: int('Questions in the snapshot.'),
    current_question_index: int('Where the player currently is, only meaningful when pacing is self.'),
    streak: int('Current correct streak.'),
    lives: nullable(int('Remaining lives, null outside survival.'), 'integer'),
    status: str('connected, disconnected, eliminated or finished.')
  }),

  AnsweredQuestion: object({
    question_id: int('Snapshot question id.'),
    question_index: int('0-based question number, the one to print.'),
    answer: { description: 'What the player submitted: an option id, an array of ids, or free text.' },
    is_late: bool('True when the answer landed after the deadline and flow.allowAnswerLate accepted it.'),
    answered_at: time('When the server recorded the answer.')
  }),

  PlayerState: {
    type: 'object',
    description:
      'The player as seen by that player. While the answer key must stay hidden the payload is trimmed to the fields below; once the answers are revealed (flow.showCorrectAnswer, or the match is finished) the full player row is sent instead.',
    properties: {
      id: int('Player session id.'),
      player_name: str('Display name.'),
      status: str('connected, disconnected, eliminated or finished.'),
      lives: nullable(int('Remaining lives, null outside survival.'), 'integer'),
      current_question_index: int('Question the player is on.'),
      answered_questions: {
        type: 'array',
        items: ref('AnsweredQuestion'),
        description: 'Enough for the client to know which questions are already done.'
      }
    },
    additionalProperties: true
  },

  AnswerStats: {
    type: 'object',
    description:
      'Answer distribution for one question. Only total is sent while flow.showCorrectAnswer is false, because a distribution gives the answer key away.',
    properties: { total: int('Answers received for this question.') },
    additionalProperties: int('Answers received for that option id.')
  },

  QuestionStat: object({
    question_id: int('Snapshot question id.'),
    question_index: int('0-based question number, the one to print.'),
    answer_count: int('Players who answered.'),
    correct_count: int('Players who got it right.')
  }),

  GameState: object({
    session_status: str('lobby, active, paused, finished or cancelled.'),
    current_phase: str('countdown, question_active, question_locked or showing_results.'),
    mode: str('Game mode of the session.'),
    config: ref('GameConfig'),
    index: int('Current question index: the room one when the host paces, the player one otherwise.'),
    total_questions: int('Questions in the snapshot.'),
    question: nullable(ref('PublicQuestion'), 'object'),
    countdown: nullable(
      object({ startsAt: time('When the first question fires.') }),
      'object'
    ),
    endsAt: nullable(time('Deadline of the current question.'), 'string'),
    matchEndsAt: nullable(time('Marathon deadline for this player.'), 'string'),
    allow_answer_late: bool('Self-paced only: the deadline is soft, keep the inputs enabled.'),
    remainingSeconds: nullable(int('Seconds left, already computed against the server clock.'), 'integer'),
    serverTime,
    player: nullable(ref('PlayerState'), 'object'),
    leaderboard: {
      type: 'array',
      items: ref('LeaderboardRow'),
      description: 'Empty while a live score would reveal whether the current answer was right.'
    }
  }),

  SocketError: object(
    {
      event: str('The client event that failed.'),
      message: str('CODE: sentence, for example "FORBIDDEN: host only". UNAUTHORIZED, FORBIDDEN and GONE are fatal: reconnecting with the same token will fail again.')
    },
    ['event', 'message']
  )
}
