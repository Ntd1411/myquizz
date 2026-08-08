import bcrypt from 'bcrypt'
import type { PoolClient, QueryResult } from 'pg'
import { closePool, withTransaction } from './connection.js'

/**
 * Demo seed for local development and manual testing of the home page.
 *
 * Volume is deliberately moderate: enough rows to make ranking, pagination and
 * filtering observable, small enough to run in a few seconds.
 *
 * What this seed guarantees, because the home feed needs it:
 *  - game_sessions spread across 90 days, so the scoring decay produces a real
 *    ordering instead of a flat list.
 *  - different completion ratios per quiz, so completion_rate differentiates.
 *  - edge cases that must never reach the feed: private quizzes, quizzes with
 *    zero questions, and a soft deleted quiz.
 *
 * Counters are NOT written here: question_count and play_count are maintained by
 * the triggers from migration 005, hot_score and completion_rate by the scoring
 * job. Run `pnpm db:score` after seeding.
 *
 * All users share the same password, printed in the summary at the end.
 */

const DEMO_PASSWORD = 'Password123!'

// Deterministic PRNG (mulberry32) so two runs produce the same database.
function createRandom(seed: number) {
  let a = seed
  return function random(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = createRandom(20260805)

function randInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)] as T
}

function chance(probability: number): boolean {
  return random() < probability
}

/**
 * Reads the single row of an `insert ... returning` result.
 * Throws with context instead of using a non-null assertion, so a silent schema
 * change surfaces as a clear error rather than a crash on undefined.
 */
function firstRow<T extends object>(result: QueryResult<T>, context: string): T {
  const [row] = result.rows
  if (!row) {
    throw new Error(`Expected one returned row from ${context}, got none`)
  }
  return row
}

/** Timestamp N days ago, with a random time of day. */
function daysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(randInt(0, 23), randInt(0, 59), randInt(0, 59), 0)
  return date
}

function sessionCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => pick(alphabet.split(''))).join('')
}

// ---------------------------------------------------------------------------
// Static content pools
// ---------------------------------------------------------------------------

type SeedUser = {
  fullname: string
  email: string
  role: 'admin' | 'moderator' | 'user'
  provider: 'local' | 'google'
  // Set only on the accounts the listing endpoints are tested against:
  //  - no_public: exists, but owns nothing a public profile may show
  //  - deleted: soft deleted, so its public profile must answer 404
  kind?: 'no_public' | 'deleted'
}

const USERS: readonly SeedUser[] = [
  { fullname: 'Admin Myquizz', email: 'admin@myquizz.dev', role: 'admin', provider: 'local' },
  { fullname: 'Mod Myquizz', email: 'mod@myquizz.dev', role: 'moderator', provider: 'local' },
  { fullname: 'Nguyen Thanh Dung', email: 'dung@example.com', role: 'user', provider: 'local' },
  { fullname: 'Tran Minh Anh', email: 'minhanh@example.com', role: 'user', provider: 'local' },
  { fullname: 'Le Quoc Bao', email: 'quocbao@example.com', role: 'user', provider: 'local' },
  { fullname: 'Pham Thu Ha', email: 'thuha@example.com', role: 'user', provider: 'local' },
  { fullname: 'Hoang Gia Khiem', email: 'giakhiem@example.com', role: 'user', provider: 'local' },
  { fullname: 'Vo Thi Lan', email: 'thilan@example.com', role: 'user', provider: 'local' },
  { fullname: 'Dang Hoai Nam', email: 'hoainam@example.com', role: 'user', provider: 'local' },
  { fullname: 'Bui Kim Chi', email: 'kimchi@example.com', role: 'user', provider: 'local' },
  // OAuth-only accounts: no local password at all.
  { fullname: 'Google Tester One', email: 'gtester1@gmail.com', role: 'user', provider: 'google' },
  { fullname: 'Google Tester Two', email: 'gtester2@gmail.com', role: 'user', provider: 'google' },
  // Listing edge cases. Both are kept out of the random author pool so their
  // quizzes stay exactly as seedListingEdgeCases creates them.
  { fullname: 'Nguyen Kho Trong', email: 'quiet@example.com', role: 'user', provider: 'local', kind: 'no_public' },
  { fullname: 'Tran Da Xoa', email: 'removed@example.com', role: 'user', provider: 'local', kind: 'deleted' }
]

const CATEGORIES = [
  'Math',
  'Science',
  'History',
  'Geography',
  'Programming',
  'Music',
  'Movies',
  'Sports'
] as const

type Category = (typeof CATEGORIES)[number]

// Keyed by the exact category union, so the lookup below needs no assertion.
const QUIZ_TITLES: Record<Category, readonly string[]> = {
  Math: ['Mental Math Sprint', 'Fractions and Decimals', 'Geometry Basics', 'Algebra Warm Up', 'Probability Puzzles'],
  Science: ['Human Body Basics', 'The Solar System', 'Periodic Table Drill', 'Cells and Genetics', 'Weather and Climate'],
  History: ['Ancient Civilizations', 'World War II Facts', 'Vietnamese Dynasties', 'Industrial Revolution', 'Famous Explorers'],
  Geography: ['Capitals of the World', 'Rivers and Mountains', 'Flags Challenge', 'Countries of Asia', 'Oceans and Seas'],
  Programming: ['JavaScript Fundamentals', 'SQL Joins Explained', 'Git Command Basics', 'Big O Notation', 'HTTP Status Codes'],
  Music: ['Classical Composers', 'Pop Hits of the 2000s', 'Music Theory Basics', 'Guess the Instrument', 'Rock Legends'],
  Movies: ['Oscar Winners', 'Animated Classics', 'Sci-Fi Blockbusters', 'Movie Quotes Quiz', 'Directors and Films'],
  Sports: ['World Cup History', 'Olympic Records', 'Basketball Rules', 'Tennis Grand Slams', 'Cycling Legends']
}

const LANGUAGES = ['en', 'vi'] as const

const QUESTION_TYPES = [
  'multiple_choice',
  'multiple_choice',
  'multiple_choice',
  'multiple_select',
  'short_answer',
  'long_answer'
] as const

// Popularity profile drives how many sessions a quiz gets and how recent they
// are. This is what makes hot_score differ between quizzes after scoring.
type Popularity = 'hot' | 'steady' | 'fading' | 'cold'

function sessionCountFor(popularity: Popularity): number {
  switch (popularity) {
  case 'hot':
    return randInt(10, 16)
  case 'steady':
    return randInt(5, 9)
  case 'fading':
    return randInt(3, 6)
  case 'cold':
    return randInt(0, 2)
  }
}

/** Age of a session in days, biased by the quiz popularity profile. */
function sessionAgeFor(popularity: Popularity): number {
  switch (popularity) {
  case 'hot':
    // Mostly the last two weeks: high decayed weight.
    return randInt(0, 14)
  case 'steady':
    return randInt(0, 60)
  case 'fading':
    // Only old plays: should sink to the bottom of the feed.
    return randInt(55, 89)
  case 'cold':
    return randInt(20, 89)
  }
}

// ---------------------------------------------------------------------------
// Question building
// ---------------------------------------------------------------------------

type BuiltQuestion = {
  question_type: (typeof QUESTION_TYPES)[number]
  question_text: string
  time_limit: number
  answer_options: { id: number; option_text: string }[] | null
  correct_answer: number[] | string
  question_hint: string | null
  explanation: string | null
}

function buildQuestion(topic: string, index: number): BuiltQuestion {
  const type = pick(QUESTION_TYPES)
  const time_limit = pick([15, 20, 30, 30, 45, 60])
  const hint = chance(0.4) ? `Think about the basics of ${topic.toLowerCase()}.` : null
  const explanation = chance(0.5) ? `This is a core ${topic.toLowerCase()} concept.` : null

  if (type === 'short_answer' || type === 'long_answer') {
    return {
      question_type: type,
      question_text:
        type === 'short_answer'
          ? `${topic} question ${index}: give the exact term.`
          : `${topic} question ${index}: explain the idea in your own words.`,
      time_limit: type === 'long_answer' ? 60 : time_limit,
      // Text answers carry no options; correct_answer is a plain string.
      answer_options: null,
      correct_answer: type === 'short_answer' ? `answer-${index}` : `A reasonable explanation about ${topic}.`,
      question_hint: hint,
      explanation
    }
  }

  const optionCount = type === 'multiple_select' ? randInt(4, 5) : 4
  const answer_options = Array.from({ length: optionCount }, (_, i) => ({
    id: i + 1,
    option_text: `${topic} option ${i + 1}`
  }))

  // multiple_select keeps two correct ids, multiple_choice exactly one.
  const correct_answer =
    type === 'multiple_select'
      ? Array.from(new Set([randInt(1, optionCount), randInt(1, optionCount)])).sort((a, b) => a - b)
      : [randInt(1, optionCount)]

  return {
    question_type: type,
    question_text: `${topic} question ${index}: pick the correct option.`,
    time_limit,
    answer_options,
    correct_answer,
    question_hint: hint,
    explanation
  }
}

// ---------------------------------------------------------------------------
// Seed steps
// ---------------------------------------------------------------------------

async function truncateAll(client: PoolClient) {
  // CASCADE also clears the auth side tables that reference users.
  await client.query(`
    truncate table player_sessions, game_sessions, quiz_snapshots, questions, quizzes, users
    restart identity cascade
  `)
}

async function seedUsers(client: PoolClient): Promise<number[]> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  const ids: number[] = []

  for (const [index, user] of USERS.entries()) {
    const isGoogle = user.provider === 'google'

    const result = await client.query<{ id: number }>(
      `insert into users
         (fullname, email, phone, password, role, avatar, description,
          google_id, auth_provider, deleted_at, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
       returning id`,
      [
        user.fullname,
        user.email,
        // Unique phone per user; Google accounts intentionally have none.
        isGoogle ? null : `09${String(10000000 + index).slice(0, 8)}`,
        isGoogle ? null : passwordHash,
        user.role,
        null,
        `Demo ${user.role} account`,
        isGoogle ? `google-oauth-${index}` : null,
        user.provider,
        // One account is soft deleted so its public profile must answer 404.
        user.kind === 'deleted' ? daysAgo(randInt(1, 30)) : null,
        daysAgo(randInt(120, 200))
      ]
    )

    ids.push(firstRow(result, 'insert users').id)
  }

  return ids
}

type SeededQuiz = {
  id: number
  ownerId: number
  name: string
  category: Category
  isPublic: boolean
  questionIds: number[]
  popularity: Popularity
  /** Probability that a player of this quiz reaches 'finished'. */
  finishRate: number
}

async function seedQuizzes(client: PoolClient, userIds: number[]): Promise<SeededQuiz[]> {
  const quizzes: SeededQuiz[] = []
  // Authors only: skip admin and moderator so ownership looks realistic, and skip
  // the listing edge case accounts, whose quizzes are created explicitly later.
  const authorIds = userIds.filter((_, index) => index >= 2 && USERS[index]?.kind === undefined)

  let counter = 0

  for (const category of CATEGORIES) {
    const titles = QUIZ_TITLES[category]

    for (const title of titles) {
      counter += 1

      // Deliberate edge cases, spread across the set:
      //  - every 13th quiz is private
      //  - every 17th quiz has no questions
      //  - two quizzes are soft deleted
      const isPublic = counter % 13 !== 0
      const hasQuestions = counter % 17 !== 0
      const isDeleted = counter === 9 || counter === 28
      const isFeatured = counter % 7 === 0 && isPublic && hasQuestions && !isDeleted

      const popularity: Popularity = !isPublic || !hasQuestions || isDeleted
        ? 'cold'
        : pick(['hot', 'hot', 'steady', 'steady', 'steady', 'fading', 'cold'] as const)

      const ownerId = pick(authorIds)
      const createdAt = daysAgo(randInt(30, 110))

      const quizResult = await client.query<{ id: number }>(
        `insert into quizzes
           (quiz_owner, quiz_name, quiz_description, quiz_language, quiz_image,
            quiz_category, is_public, is_featured, deleted_at, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
         returning id`,
        [
          ownerId,
          title,
          `A ${category.toLowerCase()} quiz about ${title.toLowerCase()}.`,
          pick(LANGUAGES),
          null,
          category,
          isPublic,
          isFeatured,
          isDeleted ? daysAgo(randInt(1, 20)) : null,
          createdAt
        ]
      )

      const quizId = firstRow(quizResult, 'insert quizzes').id
      const questionIds: number[] = []

      if (hasQuestions) {
        const questionCount = randInt(5, 10)

        for (let i = 1; i <= questionCount; i += 1) {
          const question = buildQuestion(category, i)

          const questionResult = await client.query<{ id: number }>(
            `insert into questions
               (quiz_id, question_type, question_text, question_image, time_limit,
                answer_options, correct_answer, question_hint, explanation,
                created_at, updated_at)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
             returning id`,
            [
              quizId,
              question.question_type,
              question.question_text,
              null,
              question.time_limit,
              question.answer_options ? JSON.stringify(question.answer_options) : null,
              JSON.stringify(question.correct_answer),
              question.question_hint,
              question.explanation,
              createdAt
            ]
          )

          questionIds.push(firstRow(questionResult, 'insert questions').id)
        }
      }

      quizzes.push({
        id: quizId,
        ownerId,
        name: title,
        category,
        isPublic,
        questionIds,
        popularity,
        // Spread on purpose so completion_rate is not uniform.
        finishRate: Number(pick([0.15, 0.3, 0.45, 0.6, 0.8]))
      })
    }
  }

  return quizzes
}

async function seedSnapshotsAndSessions(
  client: PoolClient,
  quizzes: SeededQuiz[],
  userIds: number[]
): Promise<{ snapshots: number; sessions: number; players: number }> {
  let snapshotTotal = 0
  let sessionTotal = 0
  let playerTotal = 0

  for (const quiz of quizzes) {
    // A quiz with no questions can never be played, so it gets no snapshot.
    if (quiz.questionIds.length === 0) continue

    const questionRows = await client.query(
      `select id, question_type, question_text, time_limit, answer_options, correct_answer
       from questions
       where quiz_id = $1 and deleted_at is null
       order by id`,
      [quiz.id]
    )

    const snapshotData = {
      quiz_id: quiz.id,
      quiz_name: quiz.name,
      quiz_category: quiz.category,
      questions: questionRows.rows
    }

    // Some quizzes were edited and played again, so they have two snapshots.
    const snapshotCount = chance(0.25) ? 2 : 1
    const snapshotIds: number[] = []

    for (let s = 0; s < snapshotCount; s += 1) {
      const snapshotResult = await client.query<{ id: number }>(
        `insert into quiz_snapshots
           (quiz_id, snapshot_data, total_questions, created_at, updated_at)
         values ($1, $2, $3, $4, $4)
         returning id`,
        [quiz.id, JSON.stringify(snapshotData), quiz.questionIds.length, daysAgo(randInt(20, 100))]
      )

      snapshotIds.push(firstRow(snapshotResult, 'insert quiz_snapshots').id)
      snapshotTotal += 1
    }

    const sessions = sessionCountFor(quiz.popularity)

    for (let i = 0; i < sessions; i += 1) {
      const createdAt = daysAgo(sessionAgeFor(quiz.popularity))
      const gameMode = pick(['classic', 'classic', 'solo', 'marathon', 'team', 'survival', 'practice'] as const)
      // Most sessions are done; the rest exercise the other states.
      const status = pick(['finished', 'finished', 'finished', 'finished', 'cancelled', 'lobby', 'active'] as const)
      const isOver = status === 'finished' || status === 'cancelled'

      const startedAt = status === 'lobby' ? null : new Date(createdAt.getTime() + 60_000)
      const finishedAt =
        status === 'finished' ? new Date(createdAt.getTime() + randInt(5, 25) * 60_000) : null

      const playerCount = status === 'lobby' ? randInt(1, 4) : randInt(3, 8)

      const sessionResult = await client.query<{ id: number }>(
        `insert into game_sessions
           (quiz_snapshot_id, session_name, session_code, session_host, total_players,
            total_questions, session_status, game_mode, config, current_question_index,
            current_phase, started_at, finished_at, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
         returning id`,
        [
          pick(snapshotIds),
          `${quiz.name} session ${i + 1}`,
          sessionCode(),
          // The host is usually the owner, sometimes another user.
          chance(0.75) ? quiz.ownerId : pick(userIds),
          playerCount,
          quiz.questionIds.length,
          status,
          gameMode,
          JSON.stringify({ shuffle_questions: chance(0.5), show_leaderboard: true }),
          isOver ? quiz.questionIds.length : randInt(0, quiz.questionIds.length - 1),
          status === 'lobby' ? 'lobby' : isOver ? 'ended' : 'question',
          startedAt,
          finishedAt,
          createdAt
        ]
      )

      const sessionId = firstRow(sessionResult, 'insert game_sessions').id
      sessionTotal += 1

      for (let p = 0; p < playerCount; p += 1) {
        // Registered player most of the time, guest otherwise.
        const isGuest = chance(0.3)
        const playerId = isGuest ? null : pick(userIds)

        let playerStatus: 'connected' | 'disconnected' | 'eliminated' | 'finished'
        if (status === 'lobby') {
          playerStatus = 'connected'
        } else if (chance(quiz.finishRate)) {
          playerStatus = 'finished'
        } else {
          playerStatus = pick(['disconnected', 'eliminated', 'connected'] as const)
        }

        const answered =
          playerStatus === 'finished'
            ? quiz.questionIds.length
            : randInt(0, Math.max(0, quiz.questionIds.length - 1))
        const correct = answered === 0 ? 0 : randInt(0, answered)

        await client.query(
          `insert into player_sessions
             (game_session_id, quiz_id, player_id, player_guest_id, player_name,
              player_score, answered_questions, correct_answers_count, streak, lives,
              current_question_index, status, created_at, updated_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
          [
            sessionId,
            quiz.id,
            playerId,
            isGuest ? `guest-${sessionId}-${p}` : null,
            isGuest ? `Guest ${p + 1}` : `Player ${p + 1}`,
            correct * randInt(80, 120),
            JSON.stringify(quiz.questionIds.slice(0, answered)),
            correct,
            randInt(0, Math.min(correct, 5)),
            // Only survival mode tracks lives.
            gameMode === 'survival' ? randInt(0, 3) : null,
            answered,
            playerStatus,
            new Date(createdAt.getTime() + randInt(10, 120) * 1000)
          ]
        )

        playerTotal += 1
      }
    }
  }

  return { snapshots: snapshotTotal, sessions: sessionTotal, players: playerTotal }
}

// ---------------------------------------------------------------------------
// Listing edge cases (search, public profile, /quizzes/me)
// ---------------------------------------------------------------------------

/**
 * Inserts one quiz plus its questions and returns the new quiz id.
 *
 * Unlike the bulk seed, created_at comes from the caller instead of a random
 * offset: the listing tests need dates they can predict and compare.
 */
async function insertListingQuiz(
  client: PoolClient,
  quiz: {
    ownerId: number
    name: string
    category: Category
    language: string
    isPublic: boolean
    createdAt: Date
    questionCount: number
  }
): Promise<number> {
  const quizResult = await client.query<{ id: number }>(
    `insert into quizzes
       (quiz_owner, quiz_name, quiz_description, quiz_language, quiz_image,
        quiz_category, is_public, is_featured, deleted_at, created_at, updated_at)
     values ($1, $2, $3, $4, null, $5, $6, false, null, $7, $7)
     returning id`,
    [
      quiz.ownerId,
      quiz.name,
      `Listing edge case: ${quiz.name}.`,
      quiz.language,
      quiz.category,
      quiz.isPublic,
      quiz.createdAt
    ]
  )

  const quizId = firstRow(quizResult, 'insert listing quiz').id

  for (let i = 1; i <= quiz.questionCount; i += 1) {
    const question = buildQuestion(quiz.category, i)

    await client.query(
      `insert into questions
         (quiz_id, question_type, question_text, question_image, time_limit,
          answer_options, correct_answer, question_hint, explanation,
          created_at, updated_at)
       values ($1, $2, $3, null, $4, $5, $6, $7, $8, $9, $9)`,
      [
        quizId,
        question.question_type,
        question.question_text,
        question.time_limit,
        question.answer_options ? JSON.stringify(question.answer_options) : null,
        JSON.stringify(question.correct_answer),
        question.question_hint,
        question.explanation,
        quiz.createdAt
      ]
    )
  }

  return quizId
}

/** Finds the id of the demo user seeded for a given listing edge case. */
function edgeCaseUserId(userIds: number[], kind: NonNullable<SeedUser['kind']>): number {
  const index = USERS.findIndex((user) => user.kind === kind)
  const id = index === -1 ? undefined : userIds[index]

  if (id === undefined) {
    throw new Error(`Missing demo user for listing edge case: ${kind}`)
  }

  return id
}

/**
 * Rows that exist only to make the listing endpoints testable by hand:
 *  - an account whose public profile is empty although the account exists
 *  - a soft deleted account that still owns a public quiz (profile must 404)
 *  - titles starting with digits, lowercase letters and Vietnamese diacritics
 *  - created_at spread across roughly a year for created_from / created_to
 *  - two quizzes sharing created_at to the second, so paging needs the id
 *
 * Returns how many quizzes were inserted.
 */
async function seedListingEdgeCases(client: PoolClient, userIds: number[]): Promise<number> {
  const quietOwnerId = edgeCaseUserId(userIds, 'no_public')
  const removedOwnerId = edgeCaseUserId(userIds, 'deleted')
  // A normal author owns the ordering and date samples so they show up in search.
  const authorId = userIds[2] ?? quietOwnerId

  let inserted = 0

  // The quiet author exists but owns nothing a public profile may show: the
  // private quizzes are hidden by is_public, the last one by question_count.
  const quietQuizzes = [
    { name: 'Bản Nháp Riêng Tư 1', isPublic: false, questionCount: 6, days: 40 },
    { name: 'Bản Nháp Riêng Tư 2', isPublic: false, questionCount: 5, days: 25 },
    { name: 'Quiz Công Khai Chưa Có Câu Hỏi', isPublic: true, questionCount: 0, days: 12 }
  ] as const

  for (const quiz of quietQuizzes) {
    await insertListingQuiz(client, {
      ownerId: quietOwnerId,
      name: quiz.name,
      category: 'Programming',
      language: 'vi',
      isPublic: quiz.isPublic,
      createdAt: daysAgo(quiz.days),
      questionCount: quiz.questionCount
    })
    inserted += 1
  }

  // The removed account owns a perfectly valid public quiz. Its profile must
  // still answer 404, which proves the user check runs before the quiz query.
  await insertListingQuiz(client, {
    ownerId: removedOwnerId,
    name: 'Quiz Của Tài Khoản Đã Xoá',
    category: 'History',
    language: 'vi',
    isPublic: true,
    createdAt: daysAgo(60),
    questionCount: 7
  })
  inserted += 1

  // Ordering and date filters. Titles cover digits, diacritics and casing;
  // created_at ranges from about ten months ago to last week.
  const catalogue = [
    { name: '007 Spy Movie Trivia', days: 300, category: 'Movies', language: 'en' },
    { name: '100 Cau Hoi Khong Dau', days: 250, category: 'History', language: 'vi' },
    { name: '42 Thử Thách Toán Học', days: 205, category: 'Math', language: 'vi' },
    { name: 'Ánh Sáng và Âm Thanh', days: 170, category: 'Science', language: 'vi' },
    { name: 'Đại Số Cơ Bản', days: 135, category: 'Math', language: 'vi' },
    { name: 'Ôn Tập Địa Lý Việt Nam', days: 95, category: 'Geography', language: 'vi' },
    { name: 'zebra facts for night owls', days: 33, category: 'Science', language: 'en' },
    { name: 'Zebra Facts Advanced', days: 7, category: 'Science', language: 'en' }
  ] as const

  for (const quiz of catalogue) {
    await insertListingQuiz(client, {
      ownerId: authorId,
      name: quiz.name,
      category: quiz.category,
      language: quiz.language,
      isPublic: true,
      createdAt: daysAgo(quiz.days),
      questionCount: randInt(5, 8)
    })
    inserted += 1
  }

  // Same created_at down to the second, on purpose: with sort=newest the cursor
  // has to fall back to the id, otherwise one of the two is skipped or repeated.
  const twinCreatedAt = daysAgo(50)

  for (const name of ['Twin Quiz Alpha', 'Twin Quiz Beta']) {
    await insertListingQuiz(client, {
      ownerId: authorId,
      name,
      category: 'Movies',
      language: 'en',
      isPublic: true,
      createdAt: twinCreatedAt,
      questionCount: 5
    })
    inserted += 1
  }

  return inserted
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function seedDemoData() {
  console.log('Seeding demo data...\n')

  const summary = await withTransaction(async (client) => {
    await truncateAll(client)
    console.log('  Cleared existing rows')

    const userIds = await seedUsers(client)
    console.log(`  Users: ${userIds.length}`)

    const quizzes = await seedQuizzes(client, userIds)
    const questionCount = quizzes.reduce((total, quiz) => total + quiz.questionIds.length, 0)
    console.log(`  Quizzes: ${quizzes.length} (questions: ${questionCount})`)

    const counts = await seedSnapshotsAndSessions(client, quizzes, userIds)
    console.log(`  Snapshots: ${counts.snapshots}`)
    console.log(`  Game sessions: ${counts.sessions}`)
    console.log(`  Player sessions: ${counts.players}`)

    // Runs last: these rows are never played, so they must not disturb the
    // ranking data the feed and the scoring job rely on.
    const listingEdgeCases = await seedListingEdgeCases(client, userIds)
    console.log(`  Listing edge case quizzes: ${listingEdgeCases}`)

    return { userIds, quizzes, questionCount, listingEdgeCases, ...counts }
  })

  const publicPlayable = summary.quizzes.filter((q) => q.isPublic && q.questionIds.length > 0).length
  const privateCount = summary.quizzes.filter((q) => !q.isPublic).length
  const emptyCount = summary.quizzes.filter((q) => q.questionIds.length === 0).length

  console.log('\nEdge cases seeded for feed filtering:')
  console.log(`  Public quizzes with questions (should appear): ${publicPlayable}`)
  console.log(`  Private quizzes (must never appear): ${privateCount}`)
  console.log(`  Quizzes without questions (must never appear): ${emptyCount}`)
  console.log('  Soft deleted quizzes (must never appear): 2')

  console.log(`\nEdge cases seeded for the listing endpoints: ${summary.listingEdgeCases} quizzes`)
  console.log('  quiet@example.com owns only private and empty quizzes: its public profile is 200 with []')
  console.log('  removed@example.com is soft deleted: its public profile is 404 despite owning a public quiz')
  console.log('  Titles starting with digits and Vietnamese diacritics exercise name_asc and name_desc')
  console.log('  created_at spans about a year, so created_from and created_to select real subsets')
  console.log('  Twin Quiz Alpha and Twin Quiz Beta share created_at: paging must fall back to id')

  console.log(`\nAll local accounts use the password: ${DEMO_PASSWORD}`)
  console.log('  admin@myquizz.dev (admin), mod@myquizz.dev (moderator)')
  console.log('\nNext step: pnpm db:score  (counters are set by triggers, scores by the job)')
}

// No catch that hides the cause: a failed seed must exit non-zero so it is never
// mistaken for a success. The old seed swallowed errors and reported success even
// when a table was missing.
try {
  await seedDemoData()
  console.log('\nDemo seed completed.')
} catch (error) {
  console.error('\nDemo seed failed:', error)
  process.exit(1)
} finally {
  await closePool()
}
