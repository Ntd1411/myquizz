import { gameConfigSchema } from '../../game.schemas.js'
import { normalizeConfig, getConfigSpec } from '../config.rules.js'
import type { GameModeHandler } from '../mode.type.js'
import { computeScore } from '../scoring.js'

// not from a hardcoded handler, so the host screen can explain why the score is 0
export const practiceMode: GameModeHandler = {
  mode: 'practice',
  defaultConfig: () =>
    normalizeConfig(
      gameConfigSchema.parse({
        scoring: { basePoints: 0, speedBonus: false },
        flow: {
          pacing: 'self',
          showCorrectAnswer: true,
          reviewMode: true,
          allowAnswerLate: false,
          showLeaderboard: 'never',
          shuffleQuestions: true,
          shuffleOptions: true
        },
        // 0 means no time limit at all, null would still fall back to question.time_limit
        timing: { perQuestionSeconds: 0, countdownSeconds: 0 }
      }),
      'practice'
    ),
  configSpec: getConfigSpec('practice'),
  // same code path as every other mode: basePoints is 0, so the score stays 0,
  // but the streak still reflects how the learner is doing
  evaluateAnswer: (ctx, cfg) => ({
    scoreEarned: computeScore(ctx, cfg),
    newStreak: ctx.isCorrect ? ctx.player.streak + 1 : 0
  }),
  shouldAdvance: () => true,
  isGameOver: (ctx) => ctx.noMoreQuestions
}
