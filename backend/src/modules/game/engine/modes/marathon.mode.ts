import { gameConfigSchema } from '../../game.schemas.js'
import type { AnswerOutcome, GameModeHandler } from '../mode.type.js'
import { getConfigSpec, normalizeConfig } from '../config.rules.js'
import { computeScore } from '../scoring.js'

export const marathonMode: GameModeHandler = {
  mode: 'marathon',
  defaultConfig: () =>
    normalizeConfig(
      gameConfigSchema.parse({
        flow: { pacing: 'self', allowAnswerLate: false, lives: 3, showLeaderboard: 'end_only' },
        timing: { totalMatchSeconds: 300 }
      }),
      'marathon'
    ),
  configSpec: getConfigSpec('marathon'),
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
  shouldAdvance: () => true,
  isGameOver: (ctx) => ctx.matchTimeUp || ctx.noMoreQuestions
}
