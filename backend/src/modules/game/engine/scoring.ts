import type { GameConfig } from '../game.schemas.js'
import type { AnswerContext } from './mode.type.js'

export function computeScore(ctx: AnswerContext, cfg: GameConfig): number {
  // wrong answer: only negativeMarking can move the score, and it moves it down
  if (!ctx.isCorrect)
    return cfg.scoring.negativeMarking ? Math.round(-cfg.scoring.basePoints * 0.25) : 0

  const base = cfg.scoring.basePoints

  // late answers (self-paced only): a reduced base, never a speed or streak bonus
  if (ctx.isLate) {
    const ratio = Number.isFinite(cfg.scoring.latePenaltyRatio) ? cfg.scoring.latePenaltyRatio : 0
    return Math.round(base * ratio)
  }

  // a speed bonus only makes sense when the question actually had a deadline
  const speed =
    cfg.scoring.speedBonus && ctx.timeLimit > 0
      ? Math.max(0, ((ctx.timeLimit - ctx.timeTaken) / ctx.timeLimit) * base * 0.5)
      : 0

  const streak = cfg.scoring.streak.enabled
    ? Math.min((ctx.player.streak + 1) * cfg.scoring.streak.bonusPerStep, cfg.scoring.streak.max)
    : 0

  return Math.round(base + speed + streak)
}
