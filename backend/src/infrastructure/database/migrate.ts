import fs from 'fs'
import path from 'path'
import { pool } from './connection.js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Table used to track which migration files have already run
const MIGRATIONS_TABLE = 'schema_migrations'

async function initMigrationsTable(client: import('pg').PoolClient) {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `
  await client.query(createTableSQL)
}

async function getMigratedFiles(client: import('pg').PoolClient): Promise<Set<string>> {
  const result = await client.query<{ filename: string }>(
    `SELECT filename FROM ${MIGRATIONS_TABLE}`
  )
  return new Set(result.rows.map(r => r.filename))
}

async function recordMigration(client: import('pg').PoolClient, filename: string) {
  await client.query(
    `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1)`,
    [filename]
  )
}

export async function runMigrations() {
  const client = await pool.connect()
  try {
    console.log('Starting database migrations...\n')
    await client.query('SELECT pg_advisory_lock(hashtext(\'myquizz:migrations\'))')
    await initMigrationsTable(client)
    const migratedFiles = await getMigratedFiles(client)

    const applyFile = async (directory: string, file: string) => {
      if (migratedFiles.has(file)) return
      const sql = fs.readFileSync(path.join(directory, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await recordMigration(client, file)
        await client.query('COMMIT')
        migratedFiles.add(file)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }

    // Run the base schema files first
    const schemaDir = path.join(__dirname, 'schema')
    const schemaFiles = fs.readdirSync(schemaDir).sort()

    console.log('Schema files:')
    for (const file of schemaFiles) {
      await applyFile(schemaDir, file)
    }

    // Then the incremental migration files
    const migrationsDir = path.join(__dirname, 'migrations')
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir).sort()

      console.log('\nMigration files:')
      for (const file of migrationFiles) {
        await applyFile(migrationsDir, file)
      }
    }

    console.log('\n All migrations completed!')
  } catch (error) {
    console.error(' Migration failed:', error)
    throw error
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext(\'myquizz:migrations\'))')
    client.release()
  }
}

export async function seedDatabase() {
  try {
    console.log(' Seeding database...\n')

    const seedsDir = path.join(__dirname, 'seeds')
    if (!fs.existsSync(seedsDir)) {
      console.log('No seeds directory found')
      return
    }

    const seedFiles = fs.readdirSync(seedsDir).sort()

    for (const file of seedFiles) {
      const filePath = path.join(seedsDir, file)
      const sql = fs.readFileSync(filePath, 'utf8')

      console.log(`  Seeding: ${file}`)
      await pool.query(sql)
      console.log(`  ${file} completed`)
    }

    console.log('\nSeeding completed!')
  } catch (error) {
    console.error('Seeding failed:', error)
  }
}

const args = process.argv.slice(2)
const command = args[0]

if (command === 'migrate' || command === 'seed' || command === 'migrate:seed') {
  await (async () => {
    try {
      if (command === 'migrate' || command === 'migrate:seed') {
        await runMigrations()
      }

      if (command === 'seed' || command === 'migrate:seed') {
        await seedDatabase()
      }

      process.exit(0)
    } catch (error) {
      console.error(' Error:', error)
      process.exit(1)
    }
  })()
}
