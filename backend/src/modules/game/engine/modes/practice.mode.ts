import { gameConfigSchema } from '../../game.schemas.js'
import type { GameModeHandler } from '../mode.type.js'

export const practiceMode: GameModeHandler = {
  mode: 'practice',
  defaultConfig: () =>
    gameConfigSchema.parse({
      scoring: { speedBonus: false },
      flow: { pacing: 'self', showCorrectAnswer: true, allowAnswerChange: true, reviewMode: true },
      // 0 means no time limit at all, null would still fall back to question.time_limit
      timing: { perQuestionSeconds: 0, countdownSeconds: 0 }
    }),
  validateConfig: () => {},
  // return 0 points for practice mode, as it's meant for learning and not scoring
  evaluateAnswer: () => ({ scoreEarned: 0, newStreak: 0 }),
  shouldAdvance: () => true,
  isGameOver: (ctx) => ctx.noMoreQuestions
}
