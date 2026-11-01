const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')
const base = path.resolve(__dirname, '..')
const localRequire = createRequire(base + '/package.json')
const ts = localRequire('typescript')
const assert = require('node:assert/strict')
const results = []
function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(base + '/src/' + file, 'utf8'), {
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
async function check(name, fn) {
  try { await fn(); results.push({ name, reproduced: true }) }
  catch (e) { results.push({ name, reproduced: false, error: e.message }) }
}
const fakeEnv = { JWT_SECRET: 'test-only-access-secret', JWT_REFRESH_SECRET: 'test-only-refresh-secret', JWT_EXPIRES_IN: '15m', JWT_REFRESH_EXPIRES_IN: '7d', SOCKET_JWT_SECRET: 'test-only-socket-secret', SOCKET_TOKEN_TTL: '1h' }
const envMock = { '../../infrastructure/config/envconfig.js': { env: fakeEnv } }
const AppError = load('shared/errors/AppError.ts').AppError
async function main() {
  const jwt = localRequire('jsonwebtoken')
  const sock = load('modules/game/socket.middleware.ts', { ...envMock, './game.cache.js': {}, './game.repository.js': {} })
  await check('B01 socket 1h TTL becomes 3600000 seconds instead of 3600', () => {
    const p = jwt.decode(sock.signSocketToken({ psid: 1, gsid: 1, code: 'TEST', role: 'player' }))
    assert.equal(p.exp - p.iat, 3600000)
  })
  const authUtil = load('modules/auth/auth.util.ts', envMock)
  await check('B06 same-user JWTs collide in same second', () => {
    const realNow = Date.now
    try { Date.now = () => 1800000000000; assert.deepEqual(authUtil.generateTokens(1), authUtil.generateTokens(1)) }
    finally { Date.now = realNow }
  })
  const quiz = load('modules/quiz/quiz.schema.ts')
  await check('B23 question schema accepts absent options and out-of-range correct answer', () => {
    assert.equal(quiz.createQuestionSchema.safeParse({ question_type: 'multiple_choice', question_text: 'Q', correct_answer: [999] }).success, true)
  })
  await check('B24 schema accepts quiz_description longer than database varchar(255)', () => {
    assert.equal(quiz.createQuizSchema.safeParse({ quiz_name: 'ABC', quiz_description: 'a'.repeat(500), quiz_language: 'vi', is_public: true, questions: [{ question_type: 'short_answer', question_text: 'Q', correct_answer: 'A' }] }).success, true)
    assert.match(fs.readFileSync(base + '/src/infrastructure/database/schema/002_quizzes.sql', 'utf8'), /quiz_description varchar\(255\)/)
  })
  await check('B25 date query accepts impossible calendar date', () => assert.equal(quiz.searchQuizzesSchema.safeParse({ created_from: '2026-99-99' }).success, true))
  const cache = { getGameIdByCode: async () => 1, getSession: async () => session, countPlayers: async () => 1, updatePlayer: async () => {}, setSession: async () => {}, getPlayers: async () => [player] }
  const player = { id: 5, game_session_id: 1, player_guest_id: 'secret-guest-uuid', answered_questions: [{ answer: [0], is_correct: true }] }
  const session = { id: 1, session_host: 99, session_code: 'TEST', session_status: 'finished', config: { lobby: { allowLateJoin: true, allowGuests: true, maxPlayers: 5 } } }
  let snapshotCalls = 0
  const repo = { getPlayerSessionBySessionAndGuest: async () => player, createQuizSnapshot: async () => { snapshotCalls++; return { id: 8, total_questions: 1 } }, createGameSession: async () => session }
  const gs = load('modules/game/game.service.ts', { './game.cache.js': cache, './game.repository.js': repo, './socket.middleware.js': { signSocketToken: () => 'test-token' }, './engine/registry.js': { getModeHandler: () => ({ defaultConfig: () => ({}) }) }, './engine/config.rule.js': { sanitizeConfigPatch: () => ({ patch: {}, ignored: [] }), normalizeConfig: x => x } })
  await check('B10 join accepts finished room when late joining enabled', async () => assert.equal((await gs.joinGame('TEST', { player_name: 'P', player_guest_id: 'x' })).socketToken, 'test-token'))
  await check('B11 room-full test prevents existing player rejoining', async () => {
    session.session_status = 'lobby'; session.config.lobby.maxPlayers = 1
    await assert.rejects(() => gs.joinGame('TEST', { player_name: 'P', player_guest_id: 'x' }), e => e.code === 'GAME_ROOM_FULL')
  })
  await check('B02 lobby leaks full cached player including guest bearer identity and answers', async () => {
    const out = await gs.getLobby('TEST'); assert.equal(out.players[0].player_guest_id, 'secret-guest-uuid'); assert.ok(out.players[0].answered_questions)
  })
  await check('B03 createGame snapshots arbitrary quiz without permission query', async () => {
    await gs.createGame({ quiz_id: 777, mode: 'classic', session_name: 'X' }, 2); assert.equal(snapshotCalls, 1)
  })
  const user = { id: 1, avatar: 'https://storage.test/avatars/1/old', phone: '123456789' }
  const deleted = []
  const users = { findById: async () => user, findByPhone: async () => user, uploadAvatar: async () => true }
  const us = load('modules/user/user.service.ts', { ...envMock, './user.repository.js': { userRepository: users }, '../auth/auth.repository.js': { authRepository: {} }, '../auth/auth.util.js': authUtil, '../../infrastructure/cache/redis.client.js': { __esModule: true, default: { getInstance: () => ({ del: async () => {} }) } }, '../storage/storage.service.js': { deleteFileService: async url => deleted.push(url) }, '../../infrastructure/mail/mail.service.js': { mailService: {} } })
  await check('B26 unchanged phone number is rejected as taken', async () => await assert.rejects(() => us.updateProfileService(1, undefined, user.phone), e => e.code === 'AUTH_PHONE_TAKEN'))
  await check('B27 setting identical avatar deletes the still-referenced object', async () => { await us.uploadAvatarService(1, user.avatar); assert.deepEqual(deleted, [user.avatar]) })
  await check('B28 malformed JSON returns SERVER_ERROR 500', () => {
    const handler = load('shared/middlewares/error.handler.ts').errorHandler
    const err = Object.assign(new SyntaxError('invalid JSON'), { status: 400, type: 'entity.parse.failed' })
    let status
    const res = { status(n) { status = n; return this }, json() {} }
    const warn = console.error; console.error = () => {}
    try { handler(err, { method: 'POST', originalUrl: '/v1/auth/login' }, res, () => {}); assert.equal(status, 500) } finally { console.error = warn }
  })
  console.log(JSON.stringify(results, null, 2))
  fs.writeFileSync(path.join(__dirname, 'MYQUIZZ_BACKEND_AUDIT_REPRO_RESULTS.json'), JSON.stringify(results, null, 2))
  if (results.some(r => !r.reproduced)) process.exitCode = 1
}
main().catch(e => { console.error(e); process.exitCode = 1 })
