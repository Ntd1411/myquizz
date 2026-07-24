import { gameConfigSchema } from '../../game.config.schema.js'
import type { GameModeHandler } from '../mode.type.js'

export const practiceMode: GameModeHandler = {
  mode: 'practice',
  defaultConfig: () => gameConfigSchema.parse({
    scoring: { speedBonus: false }, // practice no scoring
    flow: { pacing: 'self', showCorrectAnswer: true, allowAnswerChange: true },
    timing: { perQuestionSeconds: null } // no time limit for practice mode
  }),
  validateConfig: () => {},
  // return 0 points for practice mode, as it's meant for learning and not scoring
  evaluateAnswer: () => ({ scoreEarned: 0, newStreak: 0 }),
  shouldAdvance: () => true,
  isGameOver: (ctx) => ctx.noMoreQuestions
}
