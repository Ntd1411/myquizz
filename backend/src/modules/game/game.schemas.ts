import { z } from 'zod'

const scoringSchema = z.object({
  basePoints: z.number().default(1000),
  speedBonus: z.boolean().default(true),
  streak: z.object({
    enabled: z.boolean().default(false),
    bonusPerStep: z.number().default(100),
    max: z.number().default(500)
  }).default({ enabled: false, bonusPerStep: 100, max: 500 }),
  negativeMarking: z.boolean().default(false)
})

const timingSchema = z.object({
  perQuestionSeconds: z.number().nullable().default(null), // null = use time_limit of question
  autoAdvance: z.boolean().default(true),
  showResultsSeconds: z.number().default(5),
  totalMatchSeconds: z.number().nullable().default(null)
})

const lobbySchema = z.object({
  maxPlayers: z.number().default(100),
  allowLateJoin: z.boolean().default(false),
  allowGuests: z.boolean().default(true)
})

const flowSchema = z.object({
  pacing: z.enum(['host', 'self']).default('host'),
  allowAnswerChange: z.boolean().default(false),
  showCorrectAnswer: z.boolean().default(true),
  showLeaderboard: z.enum(['never', 'between_questions', 'end_only']).default('between_questions'),
  lives: z.number().nullable().default(null)
})

export const gameConfigSchema = z.object({
  version: z.literal(1).default(1),
  scoring: scoringSchema,
  timing: timingSchema,
  lobby: lobbySchema,
  flow: flowSchema
})

export type GameConfig = z.infer<typeof gameConfigSchema>

export const createGameSchema = z.object({
  quiz_id: z.number().positive(),
  session_name: z.string().min(2).max(100),
  mode: z.enum(['classic', 'solo', 'team', 'survival', 'marathon', 'practice']).default('classic'),
  config: gameConfigSchema.partial().optional()
})

// join game (user or guest)
export const joinGameSchema = z.object({
  player_name: z.string().min(1).max(50),
  player_id: z.number().positive().optional(), // user
  player_guest_id: z.string().uuid().optional() // guest
})

// host update game config
export const updateConfigSchema = z.object({
  config: gameConfigSchema.partial()
})

export type CreateGameInput = z.infer<typeof createGameSchema>
export type JoinGameInput = z.infer<typeof joinGameSchema>
