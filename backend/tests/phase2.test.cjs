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

test('same-second login tokens have unique IDs and carry session version', () => {
  const env = { JWT_SECRET: 'test-only-access', JWT_REFRESH_SECRET: 'test-only-refresh',
    JWT_EXPIRES_IN: '15m', JWT_REFRESH_EXPIRES_IN: '7d' }
  const jwt = localRequire('jsonwebtoken')
  const util = load('modules/auth/auth.util.ts', {
    '../../infrastructure/config/envconfig.js': { env }
  })
  const first = util.generateTokens(7, 3)
  const second = util.generateTokens(7, 3)
  assert.notEqual(first.refreshToken, second.refreshToken)
  assert.notEqual(first.accessToken, second.accessToken)
  assert.equal(jwt.decode(first.accessToken).sv, 3)
  assert.ok(jwt.decode(first.refreshToken).jti)
})

test('refresh rotation consumes and creates tokens in one transaction', async () => {
  const queries = []
  const client = { query: async (sql, params) => {
    queries.push({ sql, params })
    if (sql.includes('DELETE FROM refresh_sessions')) return { rows: [{
      family_id: 'family', device_name: 'browser', ip_address: '127.0.0.1',
      expires_at: new Date(Date.now() + 100000)
    }] }
    return { rows: [] }
  } }
  const repo = load('modules/auth/auth.repository.ts', {
    '../../infrastructure/database/connection.js': {
      pool: {}, withTransaction: async fn => fn(client)
    },
    './auth.util.js': { hashToken: () => 'hashed' }
  })
  assert.equal(await new repo.AuthRepository().rotateRefreshToken('old', 1, 'new', new Date()), true)
  assert.equal(queries.length, 3)
  assert.match(queries[0].sql, /DELETE FROM refresh_sessions[\s\S]*RETURNING \*/)
  assert.match(queries[1].sql, /INSERT INTO consumed_refresh_tokens/)
  assert.match(queries[2].sql, /INSERT INTO refresh_sessions/)
  assert.equal(queries[2].params[5], 'family')
})

test('password update increments session version and removes refresh sessions atomically', async () => {
  const queries = []
  const repo = load('modules/user/user.repository.ts', {
    '../../infrastructure/database/connection.js': {
      pool: {}, withTransaction: async fn => fn({ query: async sql => {
        queries.push(sql)
        return { rowCount: 1 }
      } })
    }
  })
  assert.equal(await new repo.UserRepository().changePassword(1, 'new-hash'), true)
  assert.match(queries[0], /session_version = session_version \+ 1/)
  assert.match(queries[1], /DELETE FROM refresh_sessions/)
})

test('two reset proof requests cannot both issue a ticket', async () => {
  let available = true
  const redis = {
    get: async () => 'person@example.com',
    hget: async () => 'token-hash',
    eval: async () => {
      if (!available) return 0
      available = false
      return 1
    }
  }
  const service = load('modules/user/user.service.ts', {
    '../../infrastructure/config/envconfig.js': { env: {} },
    './user.repository.js': { userRepository: { findByEmail: async () => ({
      id: 1, email: 'person@example.com', deleted_at: null, auth_provider: 'local'
    }) } },
    '../auth/auth.util.js': { hashToken: value => `hash:${value}` },
    '../../infrastructure/cache/redis.client.js': {
      __esModule: true, default: { getInstance: () => redis }
    },
    '../storage/storage.service.js': {},
    '../game/socket.access.js': {},
    '../../infrastructure/mail/mail.service.js': { mailService: {} }
  })
  const input = { token: 'test-token' }
  const results = await Promise.allSettled([
    service.verifyResetService(input), service.verifyResetService(input)
  ])
  assert.deepEqual(results.map(result => result.status).sort(), ['fulfilled', 'rejected'])
})

test('forgot password gives the same response shape for unknown accounts', async () => {
  const redis = { ttl: async () => -2, setex: async () => 'OK' }
  const service = load('modules/user/user.service.ts', {
    '../../infrastructure/config/envconfig.js': { env: {} },
    './user.repository.js': { userRepository: { findByEmail: async () => null } },
    '../auth/auth.util.js': { hashToken: value => `hash:${value}` },
    '../../infrastructure/cache/redis.client.js': {
      __esModule: true, default: { getInstance: () => redis }
    },
    '../storage/storage.service.js': {},
    '../game/socket.access.js': {},
    '../../infrastructure/mail/mail.service.js': { mailService: {} }
  })
  const result = await service.forgotPasswordService('missing@example.com')
  assert.ok(result.resetTime instanceof Date)
  assert.ok(result.expiresAt instanceof Date)
})
