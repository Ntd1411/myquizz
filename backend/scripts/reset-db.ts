// Wipes the database before the Open Trivia DB catalogue is imported.
//
// The demo seed (pnpm db:seed:demo) is throwaway data, so nothing here tries to
// keep it. Schema and configuration are untouched: only rows are removed.
//
// Usage:
//   pnpm db:reset                 report what would be deleted, change nothing
//   pnpm db:reset --yes           delete it
//   pnpm db:reset --yes --force   allow it while NODE_ENV=production
//
// Then: pnpm db:seed, followed by pnpm db:score.
//
// The truncate statement lives in scripts/sql/reset-db.sql so psql can run the
// exact same thing without this wrapper. There is no second copy of it here.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../src/infrastructure/config/envconfig.js'
import { closePool, pool, withTransaction } from '../src/infrastructure/database/connection.js'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const sqlFile = join(scriptsDir, 'sql', 'reset-db.sql')

// Counted before and after, so the output shows exactly what was removed.
// These identifiers are hardcoded because they are interpolated into SQL below.
const COUNTED_TABLES = [
  'users',
  'quizzes',
  'questions',
  'quiz_snapshots',
  'game_sessions',
  'player_sessions',
  'refresh_sessions',
  'blacklist_token'
] as const

type RowCount = {
  table_name: string
  rows: number
}

async function countRows(): Promise<RowCount[]> {
  const query = COUNTED_TABLES
    .map(table => `select '${table}' as table_name, count(*)::int as rows from ${table}`)
    .join(' union all ')

  const result = await pool.query<RowCount>(query)
  return result.rows
}

function report(label: string, rows: RowCount[]): void {
  console.log(`\n${label}`)

  for (const row of rows) {
    console.log(`  ${row.table_name.padEnd(18)}${row.rows}`)
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const confirmed = argv.includes('--yes')
  const forced = argv.includes('--force')

  console.log(`Target: ${env.DB_NAME} at ${env.DB_HOST}:${env.DB_PORT} (NODE_ENV=${env.NODE_ENV})`)

  report('Rows that would be deleted:', await countRows())

  // A wipe is unrecoverable, so production needs a second, explicit opt-in.
  if (env.NODE_ENV === 'production' && !forced) {
    throw new Error('Refusing to wipe a production database. Add --force if that is really the intent.')
  }

  if (!confirmed) {
    console.log('\nNothing was deleted. Re-run with --yes to go ahead.')
    return
  }

  // TRUNCATE is transactional in Postgres, so a failure here leaves the data
  // exactly as it was.
  const sql = readFileSync(sqlFile, 'utf8')
  await withTransaction(client => client.query(sql))

  report('Rows left:', await countRows())

  console.log('\nDatabase is empty. schema_migrations and home_sections were kept.')
  console.log('Import the catalogue with: pnpm db:seed')
  console.log('Then refresh ranking with: pnpm db:score')
}

try {
  await main()
} catch (error) {
  console.error('\nReset failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await closePool()
}
