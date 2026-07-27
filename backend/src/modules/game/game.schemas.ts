import { z } from 'zod'

const scoringSchema = z.object({
  basePoints: z.number().default(1000),
  speedBonus: z.boolean().default(true),
  streak: z.object({
    enabled: z.boolean().default(false),
    bonusPerStep: z.number().default(100),
    max: z.number().default(500)
  }).default({ enabled: false, bonusPerStep: 100, max: 500 }),
  negativeMarking: z.boolean().default(false),
  latePenaltyRatio: z.number().min(0).max(1).default(0.9)
})

const timingSchema = z.object({
  countdownSeconds: z.number().default(3),
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
  lives: z.number().nullable().default(null),
  allowAnswerLate: z.boolean().default(true),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  showHint: z.boolean().default(false),
  reviewMode: z.boolean().default(false)
})

export const gameConfigSchema = z.object({
  version: z.literal(1).default(1),
  scoring: scoringSchema.default(() => scoringSchema.parse({})),
  timing: timingSchema.default(() => timingSchema.parse({})),
  lobby: lobbySchema.default(() => lobbySchema.parse({})),
  flow: flowSchema.default(() => flowSchema.parse({}))
})

export type GameConfig = z.infer<typeof gameConfigSchema>

const scoringPatchSchema = z.object({
  basePoints: z.number().min(0).optional(),
  speedBonus: z.boolean().optional(),
  streak: z.object({
    enabled: z.boolean().optional(),
    bonusPerStep: z.number().min(0).optional(),
    max: z.number().min(0).optional()
  }).optional(),
  negativeMarking: z.boolean().optional(),
  latePenaltyRatio: z.number().min(0).max(1).optional()
})

const timingPatchSchema = z.object({
  countdownSeconds: z.number().min(0).max(30).optional(),
  perQuestionSeconds: z.number().min(0).nullable().optional(),
  autoAdvance: z.boolean().optional(),
  showResultsSeconds: z.number().min(0).max(60).optional(),
  totalMatchSeconds: z.number().min(0).nullable().optional()
})

const lobbyPatchSchema = z.object({
  maxPlayers: z.number().int().min(1).max(500).optional(),
  allowLateJoin: z.boolean().optional(),
  allowGuests: z.boolean().optional()
})

const flowPatchSchema = z.object({
  pacing: z.enum(['host', 'self']).optional(),
  allowAnswerChange: z.boolean().optional(),
  showCorrectAnswer: z.boolean().optional(),
  showLeaderboard: z.enum(['never', 'between_questions', 'end_only']).optional(),
  lives: z.number().int().min(1).nullable().optional(),
  allowAnswerLate: z.boolean().optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  showHint: z.boolean().optional(),
  reviewMode: z.boolean().optional()
})

// Deep-optional patch: nothing is filled with defaults, so merging a patch can
// never silently reset a sibling field (this is what flipped rooms to host pacing)
export const gameConfigPatchSchema = z.object({
  version: z.literal(1).optional(),
  scoring: scoringPatchSchema.optional(),
  timing: timingPatchSchema.optional(),
  lobby: lobbyPatchSchema.optional(),
  flow: flowPatchSchema.optional()
})

export type GameConfigPatch = z.infer<typeof gameConfigPatchSchema>

export const createGameSchema = z.object({
  quiz_id: z.number().positive(),
  session_name: z.string().min(2).max(100),
  mode: z.enum(['classic', 'solo', 'team', 'survival', 'marathon', 'practice']).default('classic'),
  config: gameConfigPatchSchema.optional()
})

// join game (user or guest)
export const joinGameSchema = z.object({
  player_name: z.string().min(1).max(50),
  player_id: z.number().positive().optional(), // user
  player_guest_id: z.string().uuid().optional() // guest
})

// host update game config
export const updateConfigSchema = z.object({
  config: gameConfigPatchSchema.default(() => gameConfigPatchSchema.parse({}))
})

export type CreateGameInput = z.infer<typeof createGameSchema>
export type JoinGameInput = z.infer<typeof joinGameSchema>
