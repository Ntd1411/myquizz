import fs from 'fs'
import path from 'path'
import { pool } from './connection.js'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Table để track migrations
const MIGRATIONS_TABLE = 'schema_migrations'

async function initMigrationsTable() {
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `
  await pool.query(createTableSQL)
}

async function getMigratedFiles(): Promise<Set<string>> {
  const result = await pool.query(
    `SELECT filename FROM ${MIGRATIONS_TABLE}`
  )
  return new Set(result.rows.map(r => r.filename))
}

async function recordMigration(filename: string) {
  await pool.query(
    `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1)`,
    [filename]
  )
}

export async function runMigrations() {
  try {
    console.log('Starting database migrations...\n')
    
    await initMigrationsTable()
    const migratedFiles = await getMigratedFiles()
    
    // Chạy schema files nếu lần đầu
    const schemaDir = path.join(__dirname, 'schema')
    const schemaFiles = fs.readdirSync(schemaDir).sort()
    
    console.log('Schema files:')
    for (const file of schemaFiles) {
      if (!migratedFiles.has(file)) {
        const filePath = path.join(schemaDir, file)
        const sql = fs.readFileSync(filePath, 'utf8')
        
        console.log(`  Running: ${file}`)
        await pool.query(sql)
        await recordMigration(file)
        console.log(` ${file} completed`)
      } else {
        console.log(` ${file} (already run)`)
      }
    }
    
    // Chạy migration files
    const migrationsDir = path.join(__dirname, 'migrations')
    if (fs.existsSync(migrationsDir)) {
      const migrationFiles = fs.readdirSync(migrationsDir).sort()
      
      console.log('\nMigration files:')
      for (const file of migrationFiles) {
        if (!migratedFiles.has(file)) {
          const filePath = path.join(migrationsDir, file)
          const sql = fs.readFileSync(filePath, 'utf8')
          
          console.log(`  Running: ${file}`)
          await pool.query(sql)
          await recordMigration(file)
          console.log(`  ${file} completed`)
        } else {
          console.log(`  ${file} (already run)`)
        }
      }
    }
    
    console.log('\n All migrations completed!')
  } catch (error) {
    console.error(' Migration failed:', error)
    process.exit(1)
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
  (async () => {
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