import { gameConfigSchema } from '../../game.schema.js'
import { computeScore } from '../scoring.js'
import type { GameModeHandler } from '../mode.type.js'
import { normalizeConfig, getConfigSpec } from '../config.rule.js'

export const survivalMode: GameModeHandler = {
  mode: 'survival',
  defaultConfig: () =>
    normalizeConfig(
      gameConfigSchema.parse({
        flow: {
          pacing: 'self', lives: 3,
          showLeaderboard: 'end_only',
          shuffleQuestions: true,
          shuffleOptions: true
        },
        scoring: { negativeMarking: false }
      }),
      'survival'
    ),
  configSpec: getConfigSpec('survival'),
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
  isGameOver: (ctx) => ctx.activePlayers < 1 || ctx.noMoreQuestions
}
