import { gameConfigSchema } from '../../game.schemas.js'
import { normalizeConfig, getConfigSpec } from '../config.rules.js'
import type { GameModeHandler } from '../mode.type.js'
import { computeScore } from '../scoring.js'

export const soloMode: GameModeHandler = {
  mode: 'solo',
  defaultConfig: () =>
    normalizeConfig(
      gameConfigSchema.parse({
        flow: {
          pacing: 'self',
          allowAnswerLate: true,
          showLeaderboard: 'end_only',
          reviewMode: true,
          showCorrectAnswer: true,
          shuffleQuestions: true,
          shuffleOptions: true
        },
        timing: { autoAdvance: true }
      }),
      'solo'
    ),
  configSpec: getConfigSpec('solo'),
  evaluateAnswer: (ctx, cfg) => ({
    scoreEarned: computeScore(ctx, cfg),
    newStreak: ctx.isCorrect ? ctx.player.streak + 1 : 0
  }),
  shouldAdvance: () => true,
  isGameOver: (ctx) => ctx.noMoreQuestions
}
