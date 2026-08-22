// Open Trivia DB -> Myquizz seed SQL, pure logic only.
//
// No network, no filesystem and no database access lives in this module, so the
// whole pipeline can be exercised offline. The CLI in scripts/build-trivia-seed.ts
// owns all I/O.
//
// Schema targeted (read from src/infrastructure/database):
//   quizzes   : quiz_owner, quiz_name varchar(255), quiz_description varchar(255),
//               quiz_language varchar(50), quiz_image, quiz_category varchar(100),
//               is_public, is_featured (migration 005), created_at, updated_at
//   questions : quiz_id, question_type check in (multiple_choice, multiple_select,
//               short_answer, long_answer), question_text varchar(255), question_image,
//               time_limit, answer_options jsonb, correct_answer jsonb,
//               question_hint, explanation (migration 003), created_at, updated_at
//
// answer_options uses numeric ids starting at 1 and correct_answer is an array of
// those ids, matching seed.demo.ts and the shape the quiz module returns.
//
// Counters are never written here: question_count and play_count belong to the
// triggers from migration 005, hot_score and completion_rate to the scoring job.

export const SOURCE_NAME = 'Open Trivia DB'
export const SOURCE_URL = 'https://opentdb.com'
export const SOURCE_LICENSE = 'CC BY-SA 4.0'

// CC BY-SA 4.0 requires attribution, and it also doubles as the marker used to
// find and delete rows from a previous run of this generator.
export const ATTRIBUTION = `Source: ${SOURCE_NAME} (${SOURCE_LICENSE}).`

// The account that owns every imported quiz. It is a real, usable account: the
// generator hashes a password with bcrypt and embeds only the hash in the SQL.
export const CURATOR_EMAIL = 'admin@myquizz.dpdns.org'
export const CURATOR_FULLNAME = 'Myquizz Admin'
export const CURATOR_ROLE = 'admin'
export const CURATOR_DESCRIPTION = `Owns the imported quiz catalogue. ${ATTRIBUTION}`

// quiz_name, quiz_description and question_text are all varchar(255).
export const MAX_TEXT = 255
export const OPTIONS_PER_QUESTION = 4
export const QUIZ_LANGUAGE = 'en'

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export type Difficulty = typeof DIFFICULTIES[number]

export const TIME_LIMIT_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 20,
  medium: 25,
  hard: 30
}

// Open Trivia DB category ids, used to walk the API one category at a time.
export const OPENTDB_CATEGORIES: ReadonlyArray<{ id: number; name: string }> = [
  { id: 9, name: 'General Knowledge' },
  { id: 10, name: 'Entertainment: Books' },
  { id: 11, name: 'Entertainment: Film' },
  { id: 12, name: 'Entertainment: Music' },
  { id: 13, name: 'Entertainment: Musicals & Theatres' },
  { id: 14, name: 'Entertainment: Television' },
  { id: 15, name: 'Entertainment: Video Games' },
  { id: 16, name: 'Entertainment: Board Games' },
  { id: 17, name: 'Science & Nature' },
  { id: 18, name: 'Science: Computers' },
  { id: 19, name: 'Science: Mathematics' },
  { id: 20, name: 'Mythology' },
  { id: 21, name: 'Sports' },
  { id: 22, name: 'Geography' },
  { id: 23, name: 'History' },
  { id: 24, name: 'Politics' },
  { id: 25, name: 'Art' },
  { id: 26, name: 'Celebrities' },
  { id: 27, name: 'Animals' },
  { id: 28, name: 'Vehicles' },
  { id: 29, name: 'Entertainment: Comics' },
  { id: 30, name: 'Science: Gadgets' },
  { id: 31, name: 'Entertainment: Japanese Anime & Manga' },
  { id: 32, name: 'Entertainment: Cartoon & Animations' }
]

export const DEFAULT_CATEGORY = 'General Knowledge'

// Open Trivia DB category name -> quizzes.quiz_category value.
// Eight of the targets are the categories already used by seed.demo.ts, so imported
// rows land on the same topic chips as the demo data instead of inventing new ones.
export const CATEGORY_MAP: Record<string, string> = {
  'General Knowledge': 'General Knowledge',
  'Entertainment: Books': 'Literature',
  'Entertainment: Film': 'Movies',
  'Entertainment: Music': 'Music',
  'Entertainment: Musicals & Theatres': 'Music',
  'Entertainment: Television': 'Television',
  'Entertainment: Video Games': 'Video Games',
  'Entertainment: Board Games': 'General Knowledge',
  'Entertainment: Comics': 'Movies',
  'Entertainment: Japanese Anime & Manga': 'Television',
  'Entertainment: Cartoon & Animations': 'Movies',
  'Science & Nature': 'Science',
  'Science: Computers': 'Programming',
  'Science: Gadgets': 'Programming',
  'Science: Mathematics': 'Math',
  Mythology: 'History',
  Sports: 'Sports',
  Geography: 'Geography',
  History: 'History',
  Politics: 'General Knowledge',
  Art: 'Art',
  Celebrities: 'Television',
  Animals: 'Animals',
  Vehicles: 'General Knowledge'
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OpenTdbQuestion = {
  category: string
  type: string
  difficulty: string
  question: string
  correct_answer: string
  incorrect_answers: string[]
}

export type NormalizedQuestion = {
  category: string
  difficulty: Difficulty
  text: string
  correct: string
  incorrect: string[]
}

export type RejectReason =
  | 'not_multiple_choice'
  | 'unknown_difficulty'
  | 'wrong_option_count'
  | 'empty_text'
  | 'text_too_long'
  | 'duplicate_option'
  | 'duplicate_question'

export type NormalizeBatchResult = {
  accepted: NormalizedQuestion[]
  rejected: Partial<Record<RejectReason, number>>
}

export type QuestionRow = {
  questionType: 'multiple_choice'
  questionText: string
  timeLimit: number
  answerOptions: Array<{ id: number; option_text: string }>
  correctAnswer: number[]
}

export type QuizDraft = {
  name: string
  description: string
  category: string
  difficulty: Difficulty
  isFeatured: boolean
  createdAt: string
  questions: QuestionRow[]
}

export type BuildQuizzesResult = {
  quizzes: QuizDraft[]
  leftover: number
}

// ---------------------------------------------------------------------------
// Decoding and cleaning
// ---------------------------------------------------------------------------

/** The API is called with encode=base64 so quotes survive transport untouched. */
export function decodeBase64(value: string): string {
  return Buffer.from(value, 'base64').toString('utf8')
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: '\'',
  lt: '<',
  gt: '>',
  nbsp: ' ',
  hellip: '...',
  ldquo: '"',
  rdquo: '"',
  lsquo: '\'',
  rsquo: '\'',
  ndash: '-',
  mdash: '-',
  eacute: 'e',
  shy: ''
}

/** Only needed for --from-file dumps; the base64 API path never carries entities. */
export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
}

/** Decodes entities, drops control characters and collapses whitespace. */
export function cleanText(value: string): string {
  return decodeHtmlEntities(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function mapCategory(openTdbCategory: string): string {
  return CATEGORY_MAP[cleanText(openTdbCategory)] ?? DEFAULT_CATEGORY
}

/** Duplicate detection key: the API repeats questions across categories. */
export function dedupeKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(value)
}

/**
 * Validates one API row against the questions table constraints.
 * Returns a reason string instead of throwing: bad rows are counted and skipped,
 * a single malformed question must never abort a ten minute crawl.
 */
export function normalizeQuestion(
  raw: OpenTdbQuestion,
  options: { decode?: boolean; seen?: Set<string> } = {}
): NormalizedQuestion | RejectReason {
  const decode = options.decode ?? false
  const read = (value: string) => cleanText(decode ? decodeBase64(value) : value)

  const type = decode ? decodeBase64(raw.type) : raw.type
  if (type !== 'multiple') {
    return 'not_multiple_choice'
  }

  const difficulty = decode ? decodeBase64(raw.difficulty) : raw.difficulty
  if (!isDifficulty(difficulty)) {
    return 'unknown_difficulty'
  }

  const incorrect = (raw.incorrect_answers ?? []).map(read).filter(value => value.length > 0)
  const correct = read(raw.correct_answer)
  const text = read(raw.question)

  if (incorrect.length + 1 !== OPTIONS_PER_QUESTION) {
    return 'wrong_option_count'
  }
  if (text.length === 0 || correct.length === 0) {
    return 'empty_text'
  }
  if (text.length > MAX_TEXT) {
    return 'text_too_long'
  }

  const allOptions = [correct, ...incorrect]
  const unique = new Set(allOptions.map(value => value.toLowerCase()))
  if (unique.size !== allOptions.length) {
    return 'duplicate_option'
  }

  if (options.seen) {
    const key = dedupeKey(text)
    if (options.seen.has(key)) {
      return 'duplicate_question'
    }
    options.seen.add(key)
  }

  return {
    category: mapCategory(decode ? decodeBase64(raw.category) : raw.category),
    difficulty,
    text,
    correct,
    incorrect
  }
}

export function normalizeBatch(
  rows: OpenTdbQuestion[],
  options: { decode?: boolean; seen?: Set<string> } = {}
): NormalizeBatchResult {
  const accepted: NormalizedQuestion[] = []
  const rejected: Partial<Record<RejectReason, number>> = {}

  for (const row of rows) {
    const result = normalizeQuestion(row, options)
    if (typeof result === 'string') {
      rejected[result] = (rejected[result] ?? 0) + 1
      continue
    }
    accepted.push(result)
  }

  return { accepted, rejected }
}

// ---------------------------------------------------------------------------
// Grouping questions into quizzes
// ---------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32), same approach as seed.demo.ts. */
export function createRandom(seed: number) {
  let a = seed
  return function random(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const a = copy[i] as T
    const b = copy[j] as T
    copy[i] = b
    copy[j] = a
  }
  return copy
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** Shuffles the options so the correct answer is not always in the same slot. */
function toQuestionRow(question: NormalizedQuestion, random: () => number): QuestionRow {
  const shuffled = shuffle([question.correct, ...question.incorrect], random)
  const answerOptions = shuffled.map((option_text, index) => ({ id: index + 1, option_text }))
  const correct = answerOptions.find(option => option.option_text === question.correct)

  if (!correct) {
    throw new Error(`Correct option vanished while shuffling: ${question.text}`)
  }

  return {
    questionType: 'multiple_choice',
    questionText: question.text,
    timeLimit: TIME_LIMIT_BY_DIFFICULTY[question.difficulty],
    answerOptions,
    correctAnswer: [correct.id]
  }
}

/**
 * Groups questions into quizzes of one category and one difficulty.
 *
 * Quizzes are picked round robin across the groups, otherwise the biggest source
 * category (General Knowledge) would fill the whole quota before the rest gets a
 * chance. Incomplete chunks are dropped: a quiz with 3 questions looks broken on
 * the home page.
 */
export function buildQuizzes(input: {
  questions: NormalizedQuestion[]
  quizCount: number
  questionsPerQuiz: number
  featuredCount: number
  seed: number
  now?: Date
}): BuildQuizzesResult {
  const { questions, quizCount, questionsPerQuiz, featuredCount, seed } = input
  const now = input.now ?? new Date()
  const random = createRandom(seed)

  const groups = new Map<string, NormalizedQuestion[]>()
  for (const question of questions) {
    const key = `${question.category}|${question.difficulty}`
    const bucket = groups.get(key)
    if (bucket) {
      bucket.push(question)
    } else {
      groups.set(key, [question])
    }
  }

  const keys = [...groups.keys()].sort()
  const chunksByKey = new Map<string, NormalizedQuestion[][]>()
  let leftover = 0

  for (const key of keys) {
    const pool = shuffle(groups.get(key) ?? [], random)
    const chunks: NormalizedQuestion[][] = []

    for (let i = 0; i + questionsPerQuiz <= pool.length; i += questionsPerQuiz) {
      chunks.push(pool.slice(i, i + questionsPerQuiz))
    }

    leftover += pool.length - chunks.length * questionsPerQuiz
    chunksByKey.set(key, chunks)
  }

  const quizzes: QuizDraft[] = []
  const perCategoryIndex = new Map<string, number>()
  const featuredCategories = new Set<string>()
  let round = 0

  while (quizzes.length < quizCount) {
    let placedThisRound = 0

    for (const key of keys) {
      if (quizzes.length >= quizCount) {
        break
      }

      const chunk = chunksByKey.get(key)?.[round]
      if (!chunk) {
        continue
      }

      const [category = DEFAULT_CATEGORY, rawDifficulty = 'easy'] = key.split('|')
      const difficulty = rawDifficulty as Difficulty
      const ordinal = (perCategoryIndex.get(category) ?? 0) + 1
      perCategoryIndex.set(category, ordinal)

      // One featured quiz per category, so Staff picks is not three flavours of the
      // same topic.
      const isFeatured = featuredCategories.size < featuredCount && !featuredCategories.has(category)
      if (isFeatured) {
        featuredCategories.add(category)
      }

      const createdAt = new Date(now.getTime() - (1 + random() * 60) * 86400000)
      const name = `${category}: ${titleCase(difficulty)} Quiz ${ordinal}`
      const description = `${chunk.length} ${difficulty} questions on ${category.toLowerCase()}. ${ATTRIBUTION}`

      quizzes.push({
        name: name.slice(0, MAX_TEXT),
        description: description.slice(0, MAX_TEXT),
        category,
        difficulty,
        isFeatured,
        createdAt: createdAt.toISOString(),
        questions: chunk.map(question => toQuestionRow(question, random))
      })

      placedThisRound += 1
    }

    if (placedThisRound === 0) {
      break
    }
    round += 1
  }

  const chunked = keys.reduce((total, key) => total + (chunksByKey.get(key)?.length ?? 0), 0)
  leftover += (chunked - quizzes.length) * questionsPerQuiz

  return { quizzes, leftover }
}

// ---------------------------------------------------------------------------
// SQL rendering
// ---------------------------------------------------------------------------

/** Postgres string literal. Doubles quotes; standard_conforming_strings is forced on in the file. */
export function sqlString(value: string): string {
  return `'${value.replace(/'/g, '\'\'')}'`
}

function sqlJson(value: unknown): string {
  return `${sqlString(JSON.stringify(value))}::jsonb`
}

function sqlTimestamp(iso: string): string {
  return `${sqlString(iso)}::timestamptz`
}

export function countBy<T>(items: T[], keyOf: (item: T) => string): Array<[string, number]> {
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = keyOf(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

/**
 * Renders the whole seed file.
 *
 * Every quiz is a single statement: a data modifying CTE inserts the quiz, and the
 * outer insert attaches its questions through the returned id. That keeps hardcoded
 * serial ids out of the file, so it also applies cleanly to a database that already
 * holds quizzes.
 */
export function renderSeedSql(input: {
  quizzes: QuizDraft[]
  curatorEmail: string
  /** bcrypt hash, never the plaintext: this file is meant to be committed. */
  curatorPasswordHash: string
  curatorRole?: string
  generatedAt?: Date
  fetchedCount?: number
}): string {
  const { quizzes, curatorEmail, curatorPasswordHash } = input
  const curatorRole = input.curatorRole ?? CURATOR_ROLE
  const generatedAt = input.generatedAt ?? new Date()
  const questionCount = quizzes.reduce((total, quiz) => total + quiz.questions.length, 0)
  const categories = countBy(quizzes, quiz => quiz.category)
  const difficulties = countBy(quizzes, quiz => quiz.difficulty)
  const owner = `(select id from users where email = ${sqlString(curatorEmail)})`

  const lines: string[] = []

  lines.push('-- Generated by scripts/build-trivia-seed.ts. Do not edit by hand.')
  lines.push(`-- Generated at : ${generatedAt.toISOString()}`)
  lines.push(`-- Source       : ${SOURCE_NAME} ${SOURCE_URL} (${SOURCE_LICENSE})`)
  lines.push(`-- Content      : ${quizzes.length} quizzes, ${questionCount} questions`)
  if (input.fetchedCount !== undefined) {
    lines.push(`-- Source rows  : ${input.fetchedCount}`)
  }
  lines.push('--')
  lines.push('-- Categories:')
  for (const [category, count] of categories) {
    lines.push(`--   ${category.padEnd(20)} ${count}`)
  }
  lines.push('-- Difficulty:')
  for (const [difficulty, count] of difficulties) {
    lines.push(`--   ${difficulty.padEnd(20)} ${count}`)
  }
  lines.push('--')
  lines.push('-- Apply with : pnpm db:seed          (runs every file in src/infrastructure/database/seeds)')
  lines.push('-- Or with    : psql --single-transaction -f <this file>')
  lines.push('-- Afterwards : pnpm db:score         (hot_score belongs to the scoring job)')
  lines.push('--')
  lines.push('-- Rerunnable: the delete below removes the rows written by a previous run and')
  lines.push('-- nothing else, because it is scoped to the curator account and to the licence')
  lines.push('-- attribution this generator puts in quiz_description.')
  lines.push('--')
  lines.push('-- question_count and play_count are left untouched on purpose: the triggers from')
  lines.push('-- migration 005 maintain them.')
  lines.push('--')
  lines.push('-- The owner account is upserted, so applying this file again resets its password')
  lines.push('-- to the hash below and clears deleted_at. Only the hash is stored here.')
  lines.push('')
  lines.push('set standard_conforming_strings = on;')
  lines.push('')
  lines.push('-- ---------------------------------------------------------------------------')
  lines.push('-- Owner account for the imported catalogue')
  lines.push('-- ---------------------------------------------------------------------------')
  lines.push('')
  lines.push('insert into users (fullname, email, password, role, description, auth_provider)')
  lines.push('values (')
  lines.push(`  ${sqlString(CURATOR_FULLNAME)},`)
  lines.push(`  ${sqlString(curatorEmail)},`)
  lines.push(`  ${sqlString(curatorPasswordHash)},`)
  lines.push(`  ${sqlString(curatorRole)},`)
  lines.push(`  ${sqlString(CURATOR_DESCRIPTION)},`)
  lines.push('  \'local\'')
  lines.push(')')
  lines.push('on conflict (email) do update set')
  lines.push('  fullname = excluded.fullname,')
  lines.push('  password = excluded.password,')
  lines.push('  role = excluded.role,')
  lines.push('  description = excluded.description,')
  lines.push('  auth_provider = excluded.auth_provider,')
  lines.push('  deleted_at = null,')
  lines.push('  updated_at = current_timestamp;')
  lines.push('')
  lines.push('-- ---------------------------------------------------------------------------')
  lines.push('-- Clear the previous import (questions cascade)')
  lines.push('-- ---------------------------------------------------------------------------')
  lines.push('')
  lines.push('delete from quizzes')
  lines.push(`where quiz_owner = ${owner}`)
  lines.push(`  and quiz_description like ${sqlString(`%${ATTRIBUTION}`)};`)
  lines.push('')
  lines.push('-- ---------------------------------------------------------------------------')
  lines.push(`-- ${quizzes.length} quizzes`)
  lines.push('-- ---------------------------------------------------------------------------')

  for (const [index, quiz] of quizzes.entries()) {
    lines.push('')
    lines.push(`-- ${index + 1}. ${quiz.name}`)
    lines.push('with new_quiz as (')
    lines.push('  insert into quizzes (')
    lines.push('    quiz_owner, quiz_name, quiz_description, quiz_language, quiz_image,')
    lines.push('    quiz_category, is_public, is_featured, created_at, updated_at')
    lines.push('  )')
    lines.push('  values (')
    lines.push(`    ${owner},`)
    lines.push(`    ${sqlString(quiz.name)},`)
    lines.push(`    ${sqlString(quiz.description)},`)
    lines.push(`    ${sqlString(QUIZ_LANGUAGE)},`)
    lines.push('    null,')
    lines.push(`    ${sqlString(quiz.category)},`)
    lines.push('    true,')
    lines.push(`    ${quiz.isFeatured ? 'true' : 'false'},`)
    lines.push(`    ${sqlTimestamp(quiz.createdAt)},`)
    lines.push(`    ${sqlTimestamp(quiz.createdAt)}`)
    lines.push('  )')
    lines.push('  returning id')
    lines.push(')')
    lines.push('insert into questions (')
    lines.push('  quiz_id, question_type, question_text, question_image, time_limit,')
    lines.push('  answer_options, correct_answer, question_hint, explanation, created_at, updated_at')
    lines.push(')')
    lines.push('select')
    lines.push('  new_quiz.id, q.question_type, q.question_text, null, q.time_limit,')
    lines.push('  q.answer_options, q.correct_answer, null, null, q.created_at, q.created_at')
    lines.push('from new_quiz')
    lines.push('cross join (values')

    const values = quiz.questions.map(question => [
      '  (',
      `${sqlString(question.questionType)}, `,
      `${sqlString(question.questionText)}, `,
      `${question.timeLimit}, `,
      `${sqlJson(question.answerOptions)}, `,
      `${sqlJson(question.correctAnswer)}, `,
      `${sqlTimestamp(quiz.createdAt)}`,
      ')'
    ].join(''))

    lines.push(values.join(',\n'))
    lines.push(') as q (')
    lines.push('  question_type, question_text, time_limit, answer_options, correct_answer, created_at')
    lines.push(');')
  }

  lines.push('')
  return `${lines.join('\n')}\n`
}
