import { gameConfigSchema } from '../../game.schemas.js'
import { getConfigSpec, normalizeConfig } from '../config.rules.js'
import type { GameModeHandler } from '../mode.type.js'
import { computeScore } from '../scoring.js'

export const classicMode: GameModeHandler = {
  mode: 'classic',
  defaultConfig: () =>
    normalizeConfig(
      gameConfigSchema.parse({
        flow: { pacing: 'host', allowAnswerLate: false, showLeaderboard: 'between_questions' }
      }),
      'classic'
    ),
  configSpec: getConfigSpec('classic'),
  evaluateAnswer: (ctx, cfg) => ({
    scoreEarned: computeScore(ctx, cfg),
    newStreak: ctx.isCorrect ? ctx.player.streak + 1 : 0
  }),
  shouldAdvance: (ctx) => ctx.allAnswered || ctx.timeUp,
  isGameOver: (ctx) => ctx.noMoreQuestions
}
