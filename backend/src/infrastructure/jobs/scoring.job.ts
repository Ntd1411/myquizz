import { pool } from '../database/connection.js'
import { env } from '../config/envconfig.js'

/**
 * Periodic quiz scoring.
 *
 * hot_score = decayed play volume * (0.5 + 0.5 * completion_rate)
 *
 * The decay is exponential with a 7 day half-life, so a quiz that stops being
 * played slides down the feed on its own without any cleanup process.
 *
 * The 0.5 + 0.5 * rate factor is deliberate: multiplying by rate directly would
 * pin every brand new quiz at 0 forever, because nobody has finished it yet and
 * a score of 0 means it is never shown, so nobody ever can.
 *
 * The 90 day window only bounds how many game_sessions rows are scanned. With a
 * 7 day half-life, a play older than 90 days contributes under 0.02% of its
 * original weight, so dropping it does not change the ranking.
 */

/**
 * Relative change in hot_score required before a row is rewritten.
 *
 * Why a threshold is needed at all: hot_score is a function of now(), so an
 * exact comparison never matches and every played quiz gets rewritten on every
 * run. Those writes are pure waste for ranking, because between two runs with no
 * new plays every decayed sum is multiplied by the SAME constant
 * exp(-ln2 * dt / 7d), and multiplying all scores by one positive constant
 * cannot change their order.
 *
 * With a 7 day half-life, idle decay crosses 1% after about 2.4 hours, so an
 * unplayed quiz is rewritten a few times a day instead of on every run. The
 * stored value is therefore at most 1% stale, which can only reorder quizzes
 * that were already within 1% of each other.
 */
const SCORE_CHANGE_THRESHOLD = 0.01

const SCORING_SQL = `
with recent as (
  select qs.quiz_id,
         sum(exp(-ln(2) * extract(epoch from (now() - gs.created_at))
                 / 86400.0 / 7)) as decayed
  from game_sessions gs
  join quiz_snapshots qs on qs.id = gs.quiz_snapshot_id
  where gs.created_at >= now() - interval '90 days'
  group by qs.quiz_id
),
completion as (
  select qs.quiz_id,
         count(*) filter (where ps.status = 'finished')::real
           / nullif(count(*), 0) as rate
  from player_sessions ps
  join game_sessions gs on gs.id = ps.game_session_id
  join quiz_snapshots qs on qs.id = gs.quiz_snapshot_id
  group by qs.quiz_id
),
scores as (
  -- Left joined from quizzes rather than joined between the two CTEs, so that a
  -- quiz whose plays have all aged out of the window is reset to 0 instead of
  -- keeping a stale score forever.
  select q.id,
         coalesce(r.decayed, 0) * (0.5 + 0.5 * coalesce(c.rate, 0)) as hot_score,
         coalesce(c.rate, 0)::real as completion_rate
  from quizzes q
  left join recent r on r.quiz_id = q.id
  left join completion c on c.quiz_id = q.id
  where q.deleted_at is null
)
update quizzes q
set hot_score = s.hot_score,
    completion_rate = s.completion_rate,
    scored_at = now()
from scores s
where q.id = s.id
  and (
    -- completion_rate is compared exactly: it does not depend on now(), so it
    -- only moves when player_sessions actually change and never causes churn.
    q.completion_rate is distinct from s.completion_rate
    -- hot_score must clear the relative threshold. Both sides zero yields
    -- 0 > 0, which is false, so untouched dead quizzes stay untouched. A reset
    -- from a non zero score down to 0 is a 100% change and always applies.
    or abs(q.hot_score - s.hot_score)
       > $1::double precision * greatest(abs(q.hot_score), abs(s.hot_score))
  )
`

export type ScoringResult = {
  updatedCount: number
  durationMs: number
}

/**
 * Recomputes hot_score and completion_rate for every live quiz in one statement.
 *
 * updatedCount is the number of quizzes whose score moved by more than
 * SCORE_CHANGE_THRESHOLD, not the number of quizzes that changed rank.
 */
export async function runQuizScoring(): Promise<ScoringResult> {
  const startedAt = Date.now()
  const result = await pool.query(SCORING_SQL, [SCORE_CHANGE_THRESHOLD])

  return {
    updatedCount: result.rowCount ?? 0,
    durationMs: Date.now() - startedAt
  }
}

// Guards against a slow run overlapping the next tick. A single process is
// assumed; running several API instances would need a database advisory lock.
let isRunning = false
let timer: NodeJS.Timeout | null = null

async function tick() {
  if (isRunning) {
    console.warn('Quiz scoring skipped: previous run still in progress')
    return
  }

  isRunning = true
  try {
    const { updatedCount, durationMs } = await runQuizScoring()
    console.log(`Quiz scoring done: ${updatedCount} quizzes updated in ${durationMs}ms`)
  } catch (error) {
    // Boundary catch on purpose: a rejected timer callback would take down the
    // whole API process. The original error is logged, not swallowed.
    console.error('Quiz scoring failed:', error)
  } finally {
    isRunning = false
  }
}

/**
 * Starts the recurring scoring job. Runs once immediately so a fresh database
 * gets a usable ranking without waiting for the first interval.
 */
export function startScoringScheduler() {
  const intervalMinutes = env.SCORING_INTERVAL_MINUTES

  if (intervalMinutes <= 0) {
    console.log('Quiz scoring scheduler disabled (SCORING_INTERVAL_MINUTES <= 0)')
    return
  }

  void tick()

  timer = setInterval(() => void tick(), intervalMinutes * 60 * 1000)
  // Do not hold the event loop open just for this timer.
  timer.unref()

  console.log(`Quiz scoring scheduler started, every ${intervalMinutes} minutes`)
}

export function stopScoringScheduler() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
