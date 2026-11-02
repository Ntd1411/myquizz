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

const env = { SOCKET_JWT_SECRET: 'test-only-secret', SOCKET_TOKEN_TTL: '1h' }
const envMock = { '../../infrastructure/config/envconfig.js': { env } }

test('socket token expires after one hour and rejects expired token', () => {
  const jwt = localRequire('jsonwebtoken')
  const socket = load('modules/game/socket.middleware.ts', {
    ...envMock,
    './game.cache.js': {},
    './game.repository.js': {}
  })
  const token = socket.signSocketToken({ psid: 1, gsid: 2, code: 'TEST', role: 'player' })
  const decoded = jwt.decode(token)
  assert.equal(decoded.exp - decoded.iat, 3600)
  assert.throws(() => jwt.verify(token, env.SOCKET_JWT_SECRET, { clockTimestamp: decoded.exp + 1 }))
})

function gameService(session, players, repoOverrides = {}) {
  const cache = {
    getGameIdByCode: async () => session.id,
    getSession: async () => session,
    getPlayers: async () => players,
    setSession: async () => {}
  }
  const repo = {
    getLeaderboard: async () => [{ id: 1, player_score: 10 }],
    getQuestionStats: async () => [],
    ...repoOverrides
  }
  return load('modules/game/game.service.ts', {
    './game.cache.js': cache,
    './game.repository.js': repo,
    './socket.middleware.js': { signSocketToken: () => 'token' },
    './engine/registry.js': { getModeHandler: () => ({ defaultConfig: () => ({}) }) },
    './engine/config.rule.js': {
      sanitizeConfigPatch: () => ({ patch: {}, ignored: [] }),
      normalizeConfig: x => x
    }
  })
}

test('public lobby explicitly projects cached player fields and host identity', async () => {
  const session = { id: 1, session_code: 'TEST', session_host: 7 }
  const service = gameService(session, [{
    id: 3, player_name: 'Guest', player_avatar: null, status: 'connected',
    player_score: 10, player_guest_id: 'secret', answered_questions: [{ answer: 2 }]
  }])
  const result = await service.getLobby('TEST')
  assert.equal(result.session.session_host, 7)
  assert.deepEqual(result.players, [{ id: 3, player_name: 'Guest', player_avatar: null, status: 'connected' }])
})

test('results stay hidden until finished and never mode is host only', async () => {
  const session = { id: 1, session_code: 'TEST', session_status: 'active', session_host: 7,
    config: { flow: { showLeaderboard: 'never' } } }
  const service = gameService(session, [])
  await assert.rejects(service.getResults(1, 7), { statusCode: 409 })
  session.session_status = 'finished'
  await assert.rejects(service.getResults(1, 8), { statusCode: 403 })
  await assert.rejects(service.getLeaderboard(1), { statusCode: 403 })
  assert.equal((await service.getResults(1, 7)).leaderboard.length, 1)
})

test('snapshot query enforces owner or public visibility', async () => {
  let query
  let params
  const repo = load('modules/game/game.repository.ts', {
    '../../infrastructure/database/connection.js': {
      pool: { query: async (sql, values) => {
        query = sql
        params = values
        return { rows: [{ id: 4, total_questions: 1 }] }
      } }
    }
  })
  await repo.createQuizSnapshot(12, 34)
  assert.match(query, /q\.is_public = true OR q\.quiz_owner = \$2/)
  assert.deepEqual(params, [12, 34])
})

test('avatar DB failure does not delete previous object', async () => {
  const deleted = []
  const url = 'https://assets.test/avatars/1/old'
  const service = load('modules/user/user.service.ts', {
    ...envMock,
    './user.repository.js': { userRepository: {
      findById: async () => ({ id: 1, avatar: url }),
      uploadAvatar: async () => false
    } },
    '../auth/auth.repository.js': { authRepository: {} },
    '../auth/auth.util.js': {},
    '../../infrastructure/cache/redis.client.js': { __esModule: true, default: { getInstance: () => ({ del: async () => {} }) } },
    '../storage/storage.service.js': {
      assertOwnedUpload: async () => 'avatars/1/new',
      extractKeyFromUrl: value => value === url ? 'avatars/1/old' : undefined,
      deleteFileService: async value => deleted.push(value)
    },
    '../../infrastructure/mail/mail.service.js': { mailService: {} }
  })
  await assert.rejects(service.uploadAvatarService(1, 'https://assets.test/avatars/1/new'))
  assert.deepEqual(deleted, [])
})

test('avatar replacement with the same object does not update or delete it', async () => {
  let updates = 0
  let deletes = 0
  const service = load('modules/user/user.service.ts', {
    ...envMock,
    './user.repository.js': { userRepository: {
      findById: async () => ({ id: 1, avatar: 'https://assets.test/avatars/1/same' }),
      uploadAvatar: async () => { updates++; return true }
    } },
    '../auth/auth.repository.js': { authRepository: {} },
    '../auth/auth.util.js': {},
    '../../infrastructure/cache/redis.client.js': { __esModule: true, default: { getInstance: () => ({ del: async () => {} }) } },
    '../storage/storage.service.js': {
      assertOwnedUpload: async () => 'avatars/1/same',
      extractKeyFromUrl: () => 'avatars/1/same',
      deleteFileService: async () => { deletes++ }
    },
    '../../infrastructure/mail/mail.service.js': { mailService: {} }
  })
  await service.uploadAvatarService(1, 'https://assets.test/avatars/1/same')
  assert.equal(updates, 0)
  assert.equal(deletes, 0)
})

test('error log excludes query secrets', () => {
  const { AppError } = load('shared/errors/AppError.ts')
  const { errorHandler } = load('shared/middlewares/error.handler.ts', {
    '../errors/AppError.js': { AppError }
  })
  let message = ''
  const warn = console.warn
  console.warn = value => { message = value }
  try {
    errorHandler(new AppError(400, 'Invalid', 'VALIDATION_ERROR'),
      { method: 'GET', path: '/v1/users/password-reset/ticket', originalUrl: '/v1/users/password-reset/ticket?ticket=secret' },
      { status() { return this }, json() {} }, () => {})
  } finally { console.warn = warn }
  assert.doesNotMatch(message, /secret/)
})
