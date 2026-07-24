import { gameConfigSchema } from '../../game.schemas.js'
import { computeScore } from '../scoring.js'
import type { GameModeHandler } from '../mode.type.js'

export const classicMode: GameModeHandler = {
  mode: 'classic',
  defaultConfig: () => gameConfigSchema.parse({}),
  validateConfig: () => {},

  evaluateAnswer: (ctx, cfg) => ({
    scoreEarned: computeScore(ctx, cfg),
    newStreak: ctx.isCorrect ? ctx.player.streak + 1 : 0
  }),

  shouldAdvance: (ctx) => ctx.allAnswered || ctx.timeUp,
  isGameOver: (ctx) => ctx.noMoreQuestions
}
