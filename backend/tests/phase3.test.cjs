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

test('demo seed obeys unique seats and does not fabricate active rooms', () => {
  const source = fs.readFileSync(
    path.join(base, 'src/infrastructure/database/seed.demo.ts'),
    'utf8'
  )
  assert.match(source, /const availableUserIds = \[\.\.\.userIds\]/)
  assert.match(source, /takeRandom\(availableUserIds\)/)
  assert.doesNotMatch(source, /playerId = isGuest \? null : pick\(userIds\)/)
  assert.match(source, /MODE_HANDLERS\[gameMode\]\.defaultConfig\(\)/)
  assert.doesNotMatch(source, /const status = pick\([^\n]*'active'/)
})

test('join transaction preserves max seats and lets an existing seat rejoin when full', async () => {
  const seats = []
  let lockSeen = false
  let queue = Promise.resolve()
  const client = { query: async (sql, params) => {
    if (sql.includes('FOR UPDATE')) {
      lockSeen = true
      return { rows: [{ session_status: 'lobby', config: { lobby: { maxPlayers: 2 } } }] }
    }
    if (sql.startsWith('SELECT * FROM player_sessions'))
      return { rows: seats.filter(seat => seat.player_guest_id === params[2]) }
    if (sql.startsWith('SELECT count(*)')) return { rows: [{ count: seats.length }] }
    if (sql.startsWith('INSERT INTO player_sessions')) {
      const seat = { id: seats.length + 1, player_guest_id: params[2] }
      seats.push(seat)
      return { rows: [seat] }
    }
    return { rows: [] }
  } }
  const repo = load('modules/game/game.repository.ts', {
    '../../infrastructure/database/connection.js': {
      pool: {},
      withTransaction: async fn => {
        const result = queue.then(() => fn(client))
        queue = result.catch(() => {})
        return result
      }
    }
  })
  const input = id => ({ game_session_id: 1, player_id: null, player_guest_id: `guest-${id}`,
    player_name: `Guest ${id}`, player_avatar: null, lives: null })
  const results = await Promise.allSettled(Array.from({ length: 100 }, (_, id) => repo.joinPlayerSession(input(id))))
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 2)
  assert.equal(seats.length, 2)
  assert.equal((await repo.joinPlayerSession(input(0))).id, 1)
  assert.equal(lockSeen, true)
})

test('finished room rejects joins even when late joining is enabled', async () => {
  const session = { id: 1, session_code: 'TEST', session_status: 'finished', session_host: 9,
    config: { lobby: { allowLateJoin: true, allowGuests: true } } }
  const service = load('modules/game/game.service.ts', {
    './game.cache.js': { requireGameState: () => {}, getGameIdByCode: async () => 1, getSession: async () => session },
    './game.repository.js': { joinPlayerSession: async () => { throw new Error('must not be called') } },
    './socket.middleware.js': { signSocketToken: () => 'token', signGuestHistoryToken: () => 'guest-token' },
    './engine/registry.js': { getModeHandler: () => ({ defaultConfig: () => ({}) }) },
    './engine/config.rule.js': { sanitizeConfigPatch: () => ({ patch: {}, ignored: [] }), normalizeConfig: x => x }
  })
  await assert.rejects(service.joinGame('TEST', { player_name: 'Guest', player_guest_id: 'id' }),
    { code: 'GAME_ALREADY_STARTED' })
})
