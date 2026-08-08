import { closePool } from '../database/connection.js'
import { runQuizScoring } from './scoring.job.js'

/**
 * Manual entry point for the scoring job: `pnpm db:score`.
 *
 * Used to score a freshly seeded database and to verify the decay by hand by
 * running it twice a few minutes apart.
 *
 * No catch block here on purpose: a failure must surface with its real stack
 * trace and a non-zero exit code. The finally block only releases the pool.
 */
try {
  const { updatedCount, durationMs } = await runQuizScoring()
  console.log(`Quiz scoring done: ${updatedCount} quizzes updated in ${durationMs}ms`)
} finally {
  await closePool()
}
