import type { GameConfig } from '../game.schemas.js'
import type { AnswerContext } from './mode.type.js'

export function computeScore(ctx: AnswerContext, cfg: GameConfig): number {
  // trả lời sai
  if (!ctx.isCorrect)
    return cfg.scoring.negativeMarking ? Math.round(-cfg.scoring.basePoints * 0.25) : 0

  const base = cfg.scoring.basePoints
  // thưởng tốc độ: chỉ cần bật speedBonus (đã bỏ scoring.type)
  const speed = cfg.scoring.speedBonus
    ? Math.max(0, ((ctx.timeLimit - ctx.timeTaken) / ctx.timeLimit) * base * 0.5)
    : 0
  // thưởng chuỗi đúng liên tiếp
  const streak = cfg.scoring.streak.enabled
    ? Math.min((ctx.player.streak + 1) * cfg.scoring.streak.bonusPerStep, cfg.scoring.streak.max)
    : 0

  return Math.round(base + speed + streak)
}
