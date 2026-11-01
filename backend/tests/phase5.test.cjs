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

test('answer claim fails promptly while Redis is disconnected', async () => {
  const cache = load('modules/game/game.cache.ts', {
    '../../infrastructure/cache/redis.client.js': { redisClient: { status: 'reconnecting' } }
  })
  await assert.rejects(
    () => cache.recordAnswer(5, 0, 1, { answer: 1, isCorrect: true, timeTaken: 1, scoreEarned: 10 }),
    error => error.code === 'SERVICE_UNAVAILABLE' && error.statusCode === 503
  )
})
