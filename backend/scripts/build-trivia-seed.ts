// Standalone generator: fetches Open Trivia DB and renders a SQL seed file.
//
// Runs outside the app on purpose. It never opens a database connection, never
// imports anything from src/ and needs no environment variables, so it can run on a
// laptop with no local Postgres and the rendered .sql can be reviewed or committed
// before it touches any database.
//
// Usage:
//   pnpm trivia:build                            200 quizzes of 10 questions
//   pnpm trivia:build --quizzes=120 --per-quiz=8
//   pnpm trivia:build --from-file=dump.json      offline, reuse a downloaded dump
//
// Flags:
//   --quizzes=<n>       quizzes to build                    (default 200)
//   --per-quiz=<n>      questions per quiz                  (default 10)
//   --featured=<n>      quizzes flagged is_featured         (default 12)
//   --curator=<email>   account owning the quizzes          (default admin@myquizz.dpdns.org)
//   --curator-role=<r>  admin, moderator or user            (default admin)
//   --curator-password=<pw>      use this password instead of a generated one
//   --curator-password-hash=<h>  embed an existing bcrypt hash and skip hashing
//   --seed=<n>          PRNG seed, same seed same output    (default 20260822)
//   --pause=<ms>        delay between API calls             (default 5200)
//   --out=<path>        output file (default src/infrastructure/database/seeds/001_opentrivia.sql)
//   --from-file=<path>  read a JSON dump instead of calling the API
//   --print-json=<path> also dump the built quizzes as JSON, for inspection
//
// Then: pnpm db:seed, followed by pnpm db:score.

import { randomInt } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CURATOR_EMAIL,
  CURATOR_ROLE,
  DIFFICULTIES,
  OPENTDB_CATEGORIES,
  SOURCE_NAME,
  buildQuizzes,
  countBy,
  normalizeBatch,
  renderSeedSql
} from './opentrivia/trivia.js'
import type { NormalizedQuestion, OpenTdbQuestion, RejectReason } from './opentrivia/trivia.js'

const backendRoot = dirname(dirname(fileURLToPath(import.meta.url)))

// Open Trivia DB serves at most 50 questions per call and asks for one call every
// five seconds. Both numbers are theirs, not ours.
const API_BATCH = 50
const API_URL = 'https://opentdb.com/api.php'
const TOKEN_URL = 'https://opentdb.com/api_token.php?command=request'

// Fetch more than strictly needed: validation and dedupe eat into the total, and a
// category/difficulty group that cannot fill a whole quiz loses its remainder.
const OVERFETCH = 1.35

type Options = {
  quizzes: number
  perQuiz: number
  featured: number
  curator: string
  curatorRole: string
  curatorPassword: string | null
  curatorPasswordHash: string | null
  seed: number
  pause: number
  out: string
  fromFile: string | null
  printJson: string | null
}

// users.role carries exactly this check constraint.
const CURATOR_ROLES = ['admin', 'moderator', 'user'] as const

function readRole(value: string | undefined): string {
  const role = value ?? CURATOR_ROLE

  if (!(CURATOR_ROLES as readonly string[]).includes(role)) {
    throw new Error(`--curator-role must be one of ${CURATOR_ROLES.join(', ')}, got "${role}"`)
  }

  return role
}

function readPassword(value: string | undefined): string | null {
  if (value === undefined) {
    return null
  }

  if (value.length < 8) {
    throw new Error('--curator-password must be at least 8 characters')
  }

  return value
}

function parseOptions(argv: string[]): Options {
  const flags = new Map<string, string>()

  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      continue
    }
    // Split on the first '=' only: passwords and bcrypt hashes may contain more.
    const body = arg.slice(2)
    const separator = body.indexOf('=')
    const name = separator === -1 ? body : body.slice(0, separator)
    const value = separator === -1 ? 'true' : body.slice(separator + 1)
    flags.set(name, value)
  }

  const number = (name: string, fallback: number) => {
    const raw = flags.get(name)
    if (raw === undefined) {
      return fallback
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`--${name} must be a positive number, got "${raw}"`)
    }
    return Math.floor(parsed)
  }

  const defaultOut = join(backendRoot, 'src', 'infrastructure', 'database', 'seeds', '001_opentrivia.sql')
  const outFlag = flags.get('out')
  const fromFile = flags.get('from-file')
  const printJson = flags.get('print-json')

  return {
    quizzes: number('quizzes', 200),
    perQuiz: number('per-quiz', 10),
    featured: number('featured', 12),
    curator: flags.get('curator') ?? CURATOR_EMAIL,
    curatorRole: readRole(flags.get('curator-role')),
    curatorPassword: readPassword(flags.get('curator-password')),
    curatorPasswordHash: flags.get('curator-password-hash') ?? null,
    seed: number('seed', 20260822),
    pause: number('pause', 5200),
    out: outFlag ? resolve(process.cwd(), outFlag) : defaultOut,
    fromFile: fromFile ? resolve(process.cwd(), fromFile) : null,
    printJson: printJson ? resolve(process.cwd(), printJson) : null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(done => setTimeout(done, ms))
}

type CuratorCredentials = {
  hash: string
  /** Null when the caller supplied a hash, so there is nothing to print. */
  plaintext: string | null
}

// Ambiguous characters (0/O, 1/l/I) are left out: this password gets read from a
// terminal and retyped by hand.
const PASSWORD_ALPHABETS = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  'abcdefghijkmnopqrstuvwxyz',
  '23456789',
  '!@#$%^&*-_=+?'
] as const
const PASSWORD_LENGTH = 24

function createStrongPassword(): string {
  const pool = PASSWORD_ALPHABETS.join('')
  // One character per class first, so the result always satisfies the policy.
  const characters = PASSWORD_ALPHABETS.map(alphabet => alphabet[randomInt(alphabet.length)] as string)

  while (characters.length < PASSWORD_LENGTH) {
    characters.push(pool[randomInt(pool.length)] as string)
  }

  // Shuffle with the same cryptographic source, otherwise the four class
  // characters would always sit in the first four positions.
  for (let i = characters.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1)
    const a = characters[i] as string
    const b = characters[j] as string
    characters[i] = b
    characters[j] = a
  }

  return characters.join('')
}

/**
 * bcrypt is imported lazily on purpose. It is a native module, and
 * --curator-password-hash exists so the file can still be rendered on a machine
 * where it cannot be built.
 */
async function resolveCuratorPassword(options: Options): Promise<CuratorCredentials> {
  if (options.curatorPasswordHash) {
    return { hash: options.curatorPasswordHash, plaintext: null }
  }

  const plaintext = options.curatorPassword ?? createStrongPassword()
  const { default: bcrypt } = await import('bcrypt')

  // Cost 10, the same as the demo seed and the auth module.
  return { hash: await bcrypt.hash(plaintext, 10), plaintext }
}

type ApiResponse = {
  response_code: number
  results?: OpenTdbQuestion[]
}

async function requestToken(): Promise<string> {
  const response = await fetch(TOKEN_URL)
  const payload = (await response.json()) as { response_code: number; token?: string }

  if (payload.response_code !== 0 || !payload.token) {
    throw new Error(`Could not get a session token (response_code ${payload.response_code})`)
  }
  return payload.token
}

/**
 * A session token makes the API skip questions it already returned, which is the
 * only way to avoid heavy duplication when walking every category.
 *
 * Response codes: 0 ok, 1 not enough questions, 2 invalid parameter,
 * 3 token not found, 4 token exhausted, 5 rate limited.
 */
async function fetchCategory(
  categoryId: number,
  difficulty: string,
  token: string,
  pause: number
): Promise<{ rows: OpenTdbQuestion[]; token: string; refreshed: boolean }> {
  const url = `${API_URL}?amount=${API_BATCH}&category=${categoryId}&difficulty=${difficulty}`
    + `&type=multiple&encode=base64&token=${token}`

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url)

    if (response.status === 429 || response.status >= 500) {
      // Rate limited or a hiccup on their side: back off and repeat the same call.
      await sleep(pause * attempt)
      continue
    }
    if (!response.ok) {
      throw new Error(`API returned HTTP ${response.status} for category ${categoryId}`)
    }

    const payload = (await response.json()) as ApiResponse

    switch (payload.response_code) {
      case 0:
        return { rows: payload.results ?? [], token, refreshed: false }
      case 1:
        // This category and difficulty pair simply holds fewer questions than asked for.
        return { rows: [], token, refreshed: false }
      case 3:
      case 4: {
        // Token expired, or every question was already handed out: start a new session.
        await sleep(pause)
        const fresh = await requestToken()
        return { rows: [], token: fresh, refreshed: true }
      }
      case 5:
        await sleep(pause * attempt)
        continue
      default:
        throw new Error(`API rejected category ${categoryId} (response_code ${payload.response_code})`)
    }
  }

  console.warn(`  giving up on category ${categoryId} (${difficulty}) after 4 attempts`)
  return { rows: [], token, refreshed: false }
}

type Collected = {
  questions: NormalizedQuestion[]
  sourceRows: number
  rejected: Partial<Record<RejectReason, number>>
}

async function collectFromApi(options: Options): Promise<Collected> {
  const target = Math.ceil(options.quizzes * options.perQuiz * OVERFETCH)
  const seen = new Set<string>()
  const questions: NormalizedQuestion[] = []
  const rejected: Partial<Record<RejectReason, number>> = {}
  let sourceRows = 0
  let token = await requestToken()

  console.log(`Fetching from ${SOURCE_NAME}: target ${target} usable questions`)
  console.log(`One call every ${options.pause} ms, as their rate limit requires. This takes a while.\n`)

  for (const category of OPENTDB_CATEGORIES) {
    for (const difficulty of DIFFICULTIES) {
      if (questions.length >= target) {
        break
      }

      const result = await fetchCategory(category.id, difficulty, token, options.pause)
      token = result.token
      sourceRows += result.rows.length

      const batch = normalizeBatch(result.rows, { decode: true, seen })
      questions.push(...batch.accepted)

      for (const [reason, count] of Object.entries(batch.rejected)) {
        const key = reason as RejectReason
        rejected[key] = (rejected[key] ?? 0) + count
      }

      console.log(
        `  ${category.name} / ${difficulty}: +${batch.accepted.length}`
        + ` (total ${questions.length}/${target})`
        + (result.refreshed ? ' [new session token]' : '')
      )

      await sleep(options.pause)
    }
  }

  return { questions, sourceRows, rejected }
}

/** Accepts a bare array or a saved API response, so Kaggle style dumps work too. */
function collectFromFile(path: string): Collected {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as OpenTdbQuestion[] | ApiResponse
  const rows = Array.isArray(parsed) ? parsed : parsed.results ?? []

  console.log(`Reading ${rows.length} rows from ${relative(process.cwd(), path)}`)

  const batch = normalizeBatch(rows, { decode: false, seen: new Set<string>() })
  return { questions: batch.accepted, sourceRows: rows.length, rejected: batch.rejected }
}

async function main() {
  const options = parseOptions(process.argv.slice(2))
  const collected = options.fromFile ? collectFromFile(options.fromFile) : await collectFromApi(options)

  console.log(`\nSource rows: ${collected.sourceRows}, usable: ${collected.questions.length}`)
  for (const [reason, count] of Object.entries(collected.rejected)) {
    console.log(`  dropped (${reason}): ${count}`)
  }

  const { quizzes, leftover } = buildQuizzes({
    questions: collected.questions,
    quizCount: options.quizzes,
    questionsPerQuiz: options.perQuiz,
    featuredCount: options.featured,
    seed: options.seed
  })

  if (quizzes.length === 0) {
    throw new Error('No quiz could be built. Check the source data or lower --per-quiz.')
  }

  const questionCount = quizzes.reduce((total, quiz) => total + quiz.questions.length, 0)
  console.log(`\nBuilt ${quizzes.length} quizzes (${questionCount} questions), ${leftover} questions left over`)

  for (const [category, count] of countBy(quizzes, quiz => quiz.category)) {
    console.log(`  ${category.padEnd(20)} ${count}`)
  }
  for (const [difficulty, count] of countBy(quizzes, quiz => quiz.difficulty)) {
    console.log(`  ${difficulty.padEnd(20)} ${count}`)
  }

  if (quizzes.length < options.quizzes) {
    console.warn(
      `\nOnly ${quizzes.length} of ${options.quizzes} quizzes could be filled.`
      + ' The source ran out; lower --per-quiz or --quizzes, or top up with --from-file.'
    )
  }

  const credentials = await resolveCuratorPassword(options)

  const sql = renderSeedSql({
    quizzes,
    curatorEmail: options.curator,
    curatorPasswordHash: credentials.hash,
    curatorRole: options.curatorRole,
    fetchedCount: collected.sourceRows
  })

  mkdirSync(dirname(options.out), { recursive: true })
  writeFileSync(options.out, sql, 'utf8')

  if (options.printJson) {
    mkdirSync(dirname(options.printJson), { recursive: true })
    writeFileSync(options.printJson, JSON.stringify(quizzes, null, 2), 'utf8')
    console.log(`Wrote ${relative(process.cwd(), options.printJson)}`)
  }

  const sizeKb = Math.round(Buffer.byteLength(sql, 'utf8') / 1024)
  console.log(`\nWrote ${relative(process.cwd(), options.out)} (${sizeKb} KB)`)

  console.log('\nOwner account of the imported quizzes:')
  console.log(`  email    : ${options.curator}`)
  console.log(`  role     : ${options.curatorRole}`)

  if (credentials.plaintext) {
    console.log(`  password : ${credentials.plaintext}`)
    console.log('  Save it now. The SQL file carries only the bcrypt hash.')
  } else {
    console.log('  password : unchanged, an existing bcrypt hash was supplied')
  }

  console.log('\nApply it with: pnpm db:seed')
  console.log('Then refresh ranking with: pnpm db:score')
}

await main()
