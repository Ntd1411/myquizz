import { gameConfigSchema } from '../../game.schemas.js'
import { computeScore } from '../scoring.js'
import type { GameModeHandler } from '../mode.type.js'

export const soloMode: GameModeHandler = {
  mode: 'solo',
  defaultConfig: () => gameConfigSchema.parse({ flow: { pacing: 'self' } }),
  validateConfig: () => {},
  evaluateAnswer: (ctx, cfg) => ({
    scoreEarned: computeScore(ctx, cfg),
    newStreak: ctx.isCorrect ? ctx.player.streak + 1 : 0
  }),
  shouldAdvance: () => true, // self-paced: each player advances at their own pace
  isGameOver: (ctx) => ctx.noMoreQuestions // self-paced: game ends when the player has no more questions
}
