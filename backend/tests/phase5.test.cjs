const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const base = path.resolve(__dirname, '..')
const localRequire = createRequire(path.join(base, 'package.json'))
const ts = localRequire('typescript')

function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(base, 'src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText
  const mod = { exports: {} }
  const req = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id]
    if (!id.startsWith('.')) return localRequire(id)
    return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), id)).replace(/\.js$/, '.ts'), mocks)
  }
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports)
  return mod.exports
}

test('continue playing excludes closed rooms and eliminated players', async () => {
  let sql
  const repo = load('modules/quiz/feed.repository.ts', {
    '../../infrastructure/database/connection.js': { pool: { query: async query => {
      sql = query
      return { rows: [] }
    } } }
  })
  await repo.getContinuePlaying(1, 10)
  assert.match(sql, /gs\.session_status in \('lobby', 'active', 'paused'\)/)
  assert.match(sql, /ps\.status in \('connected', 'disconnected'\)/)
})

test('home cache key changes after quiz generation advances', async () => {
  const keys = []
  let generation = 1
  const home = load('modules/quiz/home.service.ts', {
    '../../infrastructure/database/connection.js': { pool: { query: async () => ({
      rows: [{ generation: String(generation) }]
    }) } },
    '../../infrastructure/cache/cache.helper.js': {
      DEFAULT_CACHE_TTL_SECONDS: 300,
      getOrSetCache: async key => { keys.push(key); return { value: [], cached: false } }
    },
    './feed.repository.js': {},
    './feed.cursor.js': { decodeFeedCursor: () => null, encodeFeedCursor: () => '' }
  })
  await home.getHomeService()
  generation++
  await home.getHomeService()
  assert.notEqual(keys[0], keys[1])
})

test('quiz listing mutations and scoring invalidate public caches', async () => {
  const migration = fs.readFileSync(path.join(
    base,
    'src/infrastructure/database/migrations/020_quiz_cache_invalidation.sql'
  ), 'utf8')
  assert.match(migration, /UPDATE OF[\s\S]*is_public[\s\S]*is_featured[\s\S]*deleted_at/)

  let scoringSql
  const scoring = load('infrastructure/jobs/scoring.job.ts', {
    '../database/connection.js': { pool: {} },
    '../config/envconfig.js': { env: { SCORING_INTERVAL_MINUTES: 0 } }
  })
  const result = await scoring.runQuizScoring({ query: async sql => {
    scoringSql = sql
    return { rows: [{ updated_count: 3 }], rowCount: 1 }
  } })
  assert.deepEqual(result.updatedCount, 3)
  assert.match(scoringSql, /update quiz_cache_generation[\s\S]*exists \(select 1 from updated\)/i)
})

test('answer claim registers keys for marathon cleanup', async () => {
  let args
  const cache = load('modules/game/game.cache.ts', {
    '../../infrastructure/cache/redis.client.js': { redisClient: {
      status: 'ready',
      eval: async (...values) => { args = values; return 1 }
    } }
  })
  assert.equal(await cache.recordAnswer(5, 150, 1, { answer: 1, isCorrect: true, timeTaken: 1, scoreEarned: 10 }), true)
  assert.equal(args[1], 2)
  assert.equal(args[2], 'game:5:answers:150')
  assert.equal(args[3], 'game:5:answer_keys')
})

test('answer claim and player score are committed in one Redis script', async () => {
  let args
  const cache = load('modules/game/game.cache.ts', {
    '../../infrastructure/cache/redis.client.js': { redisClient: {
      status: 'ready',
      eval: async (...values) => { args = values; return 1 }
    } }
  })
  const player = { id: 9, player_score: 1200, answered_questions: [{ question_index: 3 }] }
  assert.equal(await cache.commitAnswer(
    5, 3, player, { answer: 1, isCorrect: true, timeTaken: 1, scoreEarned: 1200 }
  ), true)
  assert.equal(args[1], 4)
  assert.deepEqual(args.slice(2, 6), [
    'game:5:answers:3', 'game:5:answer_keys', 'game:5:players', 'game:5:leaderboard'
  ])
  assert.match(args[0], /HEXISTS/)
  assert.match(args[0], /ZADD/)
})

test('answer claim fails promptly while Redis is disconnected', async () => {
  const cache = load('modules/game/game.cache.ts', {
    '../../infrastructure/cache/redis.client.js': { redisClient: { status: 'reconnecting' } }
  })
  await assert.rejects(
    () => cache.recordAnswer(5, 0, 1, { answer: 1, isCorrect: true, timeTaken: 1, scoreEarned: 10 }),
    error => error.code === 'SERVICE_UNAVAILABLE' && error.statusCode === 503
  )
})

test('required game writes fail closed while read-cache warming stays optional', async () => {
  const cache = load('modules/game/game.cache.ts', {
    '../../infrastructure/cache/redis.client.js': { redisClient: { status: 'reconnecting' } }
  })
  const session = { id: 5, session_code: 'TEST' }
  await assert.rejects(() => cache.setSession(session), error => error.code === 'SERVICE_UNAVAILABLE')
  await assert.rejects(() => cache.updatePlayer(5, { id: 1, player_score: 0 }),
    error => error.code === 'SERVICE_UNAVAILABLE')
  assert.equal(await cache.warmSession(session), undefined)
  assert.equal(await cache.getSession(5), null)
})

test('rate limiting uses the local policy immediately when Redis disconnects', async () => {
  let redisCalls = 0
  const { createRateLimiter } = load('shared/middlewares/rate.limit.middleware.ts', {
    '../../infrastructure/cache/redis.client.js': { default: { getInstance: () => ({
      status: 'reconnecting',
      eval: async () => { redisCalls++; throw new Error('should not queue') }
    }) } }
  })
  const middleware = createRateLimiter({ windowMs: 60_000, maxRequests: 1,
    keyPrefix: 'test:offline', byIp: true, fallbackOnRedisError: true })
  const request = { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' } }
  const response = { setHeader: () => {}, once: () => {} }
  const run = () => new Promise((resolve) => middleware(request, response, resolve))
  assert.equal(await run(), undefined)
  assert.equal((await run()).code, 'RATE_LIMITED')
  assert.equal(redisCalls, 0)
})
