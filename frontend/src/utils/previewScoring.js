/**
 * Classic scoring, computed in the browser for the preview screen.
 *
 * This is a deliberate copy of `computeScore` in
 * backend/src/modules/game/engine/scoring.ts, using the classic defaults of
 * `gameConfigSchema` in backend/src/modules/game/game.schema.ts. A preview never opens a
 * room, so there is no server to ask for a score, and creating a real session just to try
 * a quiz out would leave rows in game_sessions and inflate play_count.
 *
 * Being a copy, it can drift: change the formula or the classic defaults on the backend
 * and nothing here fails, the numbers simply stop matching. That is why every screen
 * built on this calls the result an estimate.
 */

/*
 * The classic mode as the server normalises it: speed bonus on, no streak bonus, no
 * negative marking. Only the fields a preview can actually use are copied - anything
 * about a room (lobby, leaderboard, standings) has no meaning for one player.
 *
 * Two flags are set for the preview rather than copied from the classic defaults:
 *   timing.autoAdvance    - the reveal moves on by itself after showResultsSeconds, so a
 *                           rehearsal runs at the pace of the real thing instead of
 *                           waiting for a click on every single question.
 *   flow.allowAnswerLate  - the clock hitting zero does not close the question. There is
 *                           no host here to advance the room, so a late answer is still
 *                           taken, and taxed by latePenaltyRatio exactly like the server
 *                           taxes one.
 */
export const PREVIEW_CONFIG = {
  scoring: {
    basePoints: 1000,
    speedBonus: true,
    streak: { enabled: false, bonusPerStep: 100, max: 500 },
    negativeMarking: false,
  },
  timing: {
    countdownSeconds: 3,
    autoAdvance: true,
    showResultsSeconds: 2,
  },
  flow: {
    allowAnswerLate: true,
    latePenaltyRatio: 0.9,
  },
}

/** time_limit is required by the API, but an imported row can still carry a 0. */
export const PREVIEW_FALLBACK_SECONDS = 30

/**
 * Points for one answer.
 *
 * @param {object} answer
 * @param {boolean} answer.isCorrect
 * @param {number} answer.timeTaken seconds spent on the question
 * @param {number} answer.timeLimit seconds the question allowed, 0 when it had no deadline
 * @param {number} answer.streak correct answers in a row *before* this one
 * @param {boolean} answer.isLate answered after the deadline, allowed by flow.allowAnswerLate
 */
export function computePreviewScore(
  { isCorrect, timeTaken, timeLimit, streak = 0, isLate = false },
  config = PREVIEW_CONFIG,
) {
  const scoring = config.scoring

  // A wrong answer can only ever move the score down, and only with negative marking.
  if (!isCorrect) return scoring.negativeMarking ? Math.round(-scoring.basePoints * 0.25) : 0

  const base = scoring.basePoints

  // A speed bonus only makes sense when the question actually had a deadline. The server
  // clamps `timeTaken` to the limit before scoring, so the same clamp is applied here.
  const speed =
    scoring.speedBonus && timeLimit > 0
      ? Math.max(0, ((timeLimit - Math.min(timeTaken, timeLimit)) / timeLimit) * base * 0.5)
      : 0

  const bonus = scoring.streak.enabled
    ? Math.min((streak + 1) * scoring.streak.bonusPerStep, scoring.streak.max)
    : 0

  // A late answer still counts, for a little less: the whole total is taxed, so being
  // late costs more on a question answered well than on one scraped through.
  const ratio = isLate ? config.flow?.latePenaltyRatio ?? 1 : 1

  return Math.round((base + speed + bonus) * ratio)
}
