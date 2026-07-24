import { gameConfigSchema } from '../../game.schemas.js'
import { computeScore } from '../scoring.js'
import type { AnswerOutcome, GameModeHandler } from '../mode.type.js'
import { AppError } from '../../../../shared/errors/AppError.js'

export const marathonMode: GameModeHandler = {
  mode: 'marathon',
  defaultConfig: () =>
    gameConfigSchema.parse({
      flow: { pacing: 'self' },
      timing: { totalMatchSeconds: 300 } // default 5 min
    }),
  validateConfig: (cfg) => {
    if (!cfg.timing.totalMatchSeconds || cfg.timing.totalMatchSeconds < 30)
      throw new AppError(400, 'marathon cần timing.totalMatchSeconds >= 30')
  },
  evaluateAnswer: (ctx, cfg) => {
    const hasLives = ctx.player.lives !== null
    const lives = ctx.player.lives ?? 0
    const livesRemaining = hasLives
      ? ctx.isCorrect
        ? lives
        : lives - 1
      : undefined
    const result: AnswerOutcome = {
      scoreEarned: computeScore(ctx, cfg),
      newStreak: ctx.isCorrect ? ctx.player.streak + 1 : 0
    }
    if (livesRemaining !== undefined) {
      result.livesRemaining = livesRemaining
      result.eliminated = livesRemaining <= 0
    }
    return result
  },
  shouldAdvance: () => true, // self-paced
  isGameOver: (ctx) => ctx.matchTimeUp || ctx.noMoreQuestions
}
