/**
 * Game session schemas.
 *
 * GameConfig is the single source of truth for tunable match behaviour; each
 * mode ships a default config plus the list of fields a host may edit, which is
 * what ModeConfigDescriptor exposes to the client.
 */

import type { SchemaMap } from '../types.js'
import { ref } from '../types.js'

export const gameSchemas: SchemaMap = {
  GameMode: {
    type: 'string',
    enum: ['classic', 'solo', 'survival', 'marathon', 'practice'],
    default: 'classic'
  },

  GameConfig: {
    type: 'object',
    properties: {
      version: { type: 'integer', enum: [1], default: 1 },
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
      rank: { type: 'integer' },
      id: { type: 'integer' },
      player_name: { type: 'string' },
      player_score: { type: 'integer' },
      correct_answers_count: { type: 'integer' },
      streak: { type: 'integer' },
      status: { type: 'string' }
    }
  },

  QuestionStat: {
    type: 'object',
    properties: {
      question_id: { type: 'integer' },
      answer_count: { type: 'integer' },
      correct_count: { type: 'integer' }
    }
  }
}
