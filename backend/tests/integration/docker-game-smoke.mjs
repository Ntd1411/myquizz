import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { io } from 'socket.io-client'

if (process.env.MYQUIZZ_INTEGRATION_DISPOSABLE !== '1') {
  throw new Error('Set MYQUIZZ_INTEGRATION_DISPOSABLE=1 only for a disposable test database')
}

const base = process.env.MYQUIZZ_API_URL ?? 'http://localhost:3000'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) {
  throw new Error('Integration smoke tests are restricted to localhost')
}

let cookie = ''
let guestId
const call = async (method, path, body, authenticated = true) => {
  const response = await fetch(`${base}/v1${path}`, {
    method,
    headers: {
      origin: 'http://localhost:5173',
      'content-type': 'application/json',
      ...(path.endsWith('/summary') && guestId ? { 'x-guest-id': guestId } : {}),
      ...(authenticated && cookie ? { cookie } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
  if (authenticated) {
    const values = response.headers.getSetCookie?.() ?? []
    if (values.length) cookie = values.map((value) => value.split(';')[0]).join('; ')
  }
  const payload = await response.json()
  assert.equal(payload.success, true, `${method} ${path}: HTTP ${response.status}`)
  return payload.data
}

const once = (socket, event) => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), 15_000)
  socket.once(event, (payload) => { clearTimeout(timeout); resolve(payload) })
})

const email = `integration-${randomUUID()}@example.test`
const password = `T3st-${randomUUID()}`
await call('POST', '/auth/register', { email, password, fullname: 'Integration Host' })
await call('POST', '/auth/login', { email, password })
const quiz = (await call('POST', '/quizzes', {
  quiz_name: 'Docker integration quiz', quiz_language: 'en', is_public: false,
  questions: [{ question_text: 'Choose yes', question_type: 'multiple_choice',
    answer_options: ['Yes', 'No'], correct_answer: [0], time_limit: 30 }]
})).quiz
const session = (await call('POST', '/games', {
  quiz_id: quiz.id, session_name: 'Docker integration room', mode: 'classic'
})).data.session
guestId = randomUUID()
const joined = await call('POST', `/games/${session.session_code}/join`, {
  player_name: 'Integration Guest', player_guest_id: guestId
}, false)
const hostToken = (await call('POST', `/games/${session.id}/host-token`)).hostToken.socketToken
const host = io(`${base}/game`, { auth: { token: hostToken }, transports: ['websocket'] })
const player = io(`${base}/game`, { auth: { token: joined.socketToken }, transports: ['websocket'] })

try {
  await Promise.all([once(host, 'connect'), once(player, 'connect')])
  const questionStarted = once(player, 'question:started')
  host.emit('game:start')
  const question = await questionStarted
  assert.equal(question.question.index, 0)

  const ack = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Answer ACK timed out')), 10_000)
    player.emit('question:answer', { index: 0, answer: 0 }, (value) => {
      clearTimeout(timeout)
      resolve(value)
    })
  })
  assert.equal(ack.accepted, true)
  assert.equal('isCorrect' in ack, false)

  const ended = once(host, 'game:ended')
  host.emit('game:end')
  await ended
  const summary = await call('GET', `/games/${session.id}/summary`, undefined, false)
  assert.equal(summary.summary.session.session_status, 'finished')
  assert.equal(summary.summary.session.finished_at != null, true)
  assert.equal(summary.summary.leaderboard[0].player_score > 0, true)
  console.log(JSON.stringify({ room: session.session_code, checks: ['API create/join', 'Socket.IO answer', 'private grading ACK', 'host end', 'history summary'] }))
} finally {
  host.disconnect()
  player.disconnect()
}
