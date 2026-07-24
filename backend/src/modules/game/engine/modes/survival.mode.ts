import { gameConfigSchema } from '../../game.schemas.js'
import { computeScore } from '../scoring.js'
import type { GameModeHandler } from '../mode.type.js'
import { AppError } from '../../../../shared/errors/AppError.js'

export const survivalMode: GameModeHandler = {
  mode: 'survival',
  defaultConfig: () => gameConfigSchema.parse({ flow: { lives: 3 } }),
  validateConfig: (cfg) => {
    if (!cfg.flow.lives || cfg.flow.lives < 1)
      throw new AppError(400, 'survival cần flow.lives >= 1')
  },
  evaluateAnswer: (ctx, cfg) => {
    const lives = ctx.player.lives ?? 0
    const livesRemaining = ctx.isCorrect ? lives : lives - 1
    return {
      scoreEarned: computeScore(ctx, cfg),
      newStreak: ctx.isCorrect ? ctx.player.streak + 1 : 0,
      livesRemaining,
      eliminated: livesRemaining <= 0
    }
  },
  shouldAdvance: (ctx) => ctx.allAnswered || ctx.timeUp,
  isGameOver: (ctx) => ctx.activePlayers <= 1 || ctx.noMoreQuestions
}
