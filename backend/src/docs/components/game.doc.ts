/**
 * Game session schemas.
 *
 * GameConfig is the single source of truth for tunable match behaviour; each
 * mode ships a default config plus the list of fields a host may edit, which is
 * what ModeConfigDescriptor exposes to the client.
 */

import type { SchemaMap } from '../types.js'
import { arrayOf, ref } from '../types.js'

export const gameSchemas: SchemaMap = {
  GameMode: {
    type: 'string',
    enum: ['classic', 'solo', 'survival', 'marathon', 'practice'],
    default: 'classic'
  },

  GameConfig: {
    type: 'object',
    properties: {
      version: {
        type: 'number',
        default: 1,
        description:
          'z.number() with a default of 1; the schema does not pin it to that value.'
      },
      scoring: {
        type: 'object',
        properties: {
          basePoints: { type: 'number', default: 1000 },
          speedBonus: { type: 'boolean', default: true },
          streak: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean', default: false },
              bonusPerStep: { type: 'number', default: 100 },
              max: { type: 'number', default: 500 }
            }
          },
          negativeMarking: { type: 'boolean', default: false },
          latePenaltyRatio: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            default: 0.9
          }
        }
      },
      timing: {
        type: 'object',
        properties: {
          countdownSeconds: { type: 'number', default: 3 },
          perQuestionSeconds: { type: 'number', nullable: true, default: null },
          autoAdvance: { type: 'boolean', default: true },
          showResultsSeconds: { type: 'number', default: 2 },
          totalMatchSeconds: { type: 'number', nullable: true, default: null }
        }
      },
      lobby: {
        type: 'object',
        properties: {
          maxPlayers: { type: 'number', default: 100 },
          allowLateJoin: { type: 'boolean', default: false },
          allowGuests: { type: 'boolean', default: true }
        }
      },
      flow: {
        type: 'object',
        properties: {
          pacing: { type: 'string', enum: ['host', 'self'], default: 'host' },
          showCorrectAnswer: { type: 'boolean', default: true },
          showLeaderboard: {
            type: 'string',
            enum: ['never', 'between_questions', 'end_only'],
            default: 'between_questions'
          },
          lives: { type: 'number', nullable: true, default: null },
          allowAnswerLate: { type: 'boolean', default: false },
          shuffleQuestions: { type: 'boolean', default: false },
          shuffleOptions: { type: 'boolean', default: false },
          showHint: { type: 'boolean', default: false },
          reviewMode: { type: 'boolean', default: true }
        }
      }
    }
  },

  GameConfigPatch: {
    type: 'object',
    description:
      'What POST /games and PATCH /games/{id}/config actually accept (gameConfigPatchSchema). Every field is optional and omitted ones keep their stored value, so this is not GameConfig with defaults: the bounds below are the ones the patch schema enforces. Passing the schema is only the first gate. The mode then filters the patch, and a field it does not own is dropped and reported under ignored rather than failing the call. version, flow.pacing, flow.allowAnswerLate, timing.countdownSeconds, timing.showResultsSeconds, scoring.basePoints, scoring.latePenaltyRatio and the whole scoring.streak block are locked in every mode, and each mode locks more on top of that. The mode also narrows the ranges: timing.perQuestionSeconds is capped at 600, flow.lives at 10, and timing.totalMatchSeconds must be 30 to 7200. A value inside the schema bounds but outside the mode range comes back as ignored with reason invalid, not as a 400. Read GET /games/game-modes for the exact per-mode list.',
    properties: {
      version: {
        type: 'number',
        description: 'Locked in every mode: always reported under ignored.'
      },
      scoring: {
        type: 'object',
        properties: {
          basePoints: { type: 'number', minimum: 0 },
          speedBonus: { type: 'boolean' },
          streak: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              bonusPerStep: { type: 'number', minimum: 0 },
              max: { type: 'number', minimum: 0 }
            }
          },
          negativeMarking: { type: 'boolean' },
          latePenaltyRatio: { type: 'number', minimum: 0, maximum: 1 }
        }
      },
      timing: {
        type: 'object',
        properties: {
          countdownSeconds: { type: 'number', minimum: 0, maximum: 30 },
          perQuestionSeconds: {
            type: 'number',
            minimum: 0,
            nullable: true,
            description: 'null falls back to the time_limit of each question.'
          },
          autoAdvance: { type: 'boolean' },
          showResultsSeconds: { type: 'number', minimum: 0, maximum: 60 },
          totalMatchSeconds: { type: 'number', minimum: 0, nullable: true }
        }
      },
      lobby: {
        type: 'object',
        properties: {
          maxPlayers: { type: 'integer', minimum: 1, maximum: 500 },
          allowLateJoin: { type: 'boolean' },
          allowGuests: { type: 'boolean' }
        }
      },
      flow: {
        type: 'object',
        properties: {
          pacing: { type: 'string', enum: ['host', 'self'] },
          showCorrectAnswer: { type: 'boolean' },
          showLeaderboard: {
            type: 'string',
            enum: ['never', 'between_questions', 'end_only']
          },
          lives: { type: 'integer', minimum: 1, nullable: true },
          allowAnswerLate: { type: 'boolean' },
          shuffleQuestions: { type: 'boolean' },
          shuffleOptions: { type: 'boolean' },
          showHint: { type: 'boolean' },
          reviewMode: { type: 'boolean' }
        }
      }
    }
  },

  ModeConfigDescriptor: {
    type: 'object',
    description:
      'One entry returned by GET /games/game-modes (from describeModeConfig)',
    properties: {
      mode: ref('GameMode'),
      pacing: { type: 'string', enum: ['host', 'self'] },
      scored: { type: 'boolean' },
      defaultConfig: ref('GameConfig'),
      editable: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          description:
            'FieldSpec plus current default (kind, min/max/nullable/values, default)'
        }
      },
      locked: {
        type: 'object',
        additionalProperties: true,
        description: 'Dotted path mapped to current value, rendered read-only'
      }
    }
  },

  GameSession: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      quiz_snapshot_id: { type: 'integer' },
      session_name: { type: 'string' },
      session_code: { type: 'string', example: 'K7QM2B' },
      session_host: { type: 'integer' },
      total_players: { type: 'integer' },
      total_questions: { type: 'integer' },
      session_status: {
        type: 'string',
        enum: ['lobby', 'active', 'paused', 'finished', 'cancelled']
      },
      game_mode: ref('GameMode'),
      config: ref('GameConfig'),
      current_question_index: { type: 'integer' },
      current_phase: {
        type: 'string',
        enum: [
          'lobby',
          'countdown',
          'question_active',
          'question_locked',
          'showing_results',
          'finished'
        ]
      },
      phase_ends_at: { type: 'string', format: 'date-time', nullable: true }
    }
  },

  PlayerSession: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      game_session_id: { type: 'integer' },
      player_id: { type: 'integer', nullable: true },
      player_guest_id: { type: 'string', format: 'uuid', nullable: true },
      player_name: { type: 'string' },
      player_score: { type: 'integer' },
      correct_answers_count: { type: 'integer' },
      answered_questions: arrayOf('AnsweredQuestion'),
      streak: { type: 'integer' },
      lives: { type: 'integer', nullable: true },
      current_question_index: { type: 'integer' },
      status: {
        type: 'string',
        enum: ['connected', 'disconnected', 'eliminated', 'finished']
      }
    }
  },

  LobbyPlayer: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      player_name: { type: 'string' },
      player_score: { type: 'integer' },
      status: { type: 'string' }
    }
  },

  LeaderboardEntry: {
    type: 'object',
    properties: {
      rank: {
        type: 'integer',
        description:
          'The 1-based position in the returned array, not a competition rank: tied players still get different numbers.'
      },
      id: { type: 'integer' },
      player_name: { type: 'string' },
      player_score: { type: 'integer' },
      correct_answers_count: { type: 'integer' },
      streak: { type: 'integer' },
      status: { type: 'string' }
    }
  },

  AnsweredQuestion: {
    type: 'object',
    description: 'One entry of player_sessions.answered_questions',
    properties: {
      question_id: { type: 'integer' },
      question_index: { type: 'integer' },
      answer: { description: 'Whatever the player submitted for that question' },
      is_correct: { type: 'boolean' },
      is_late: { type: 'boolean' },
      time_taken: { type: 'number' },
      score_earned: { type: 'number' },
      answered_at: { type: 'string', format: 'date-time' }
    }
  },

  QuestionStat: {
    type: 'object',
    properties: {
      question_id: { type: 'integer' },
      answer_count: {
        type: 'integer',
        description:
          'count(*) is cast to int in the query, so it comes back as a JSON number.',
        example: 12
      },
      correct_count: {
        type: 'integer',
        description: 'Number of correct answers for that question.',
        example: 9
      }
    }
  }
}
