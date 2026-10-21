import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

let session, players, questions, persisted, slots
const copy = (value) => structuredClone(value)
const cache = {
  getPlayerClock: async () => null,
  getSession: async () => copy(session),
  patchSession: async (_id, patch) => copy(session = { ...session, ...patch }),
  getPlayers: async () => copy([...players.values()]),
  getPlayer: async (_id, pid) => copy(players.get(pid)),
  updatePlayer: async (_id, player) => { players.set(player.id, copy(player)) },
  setSession: async (value) => { session = copy(value) },
  getAnswerStats: async () => ({ total: 1, correct: 1 }),
  recordAnswer: async (_id, index, pid, value, allowChange) => {
    const key = `${index}:${pid}`
    if (!allowChange && slots.has(key)) return false
    slots.set(key, copy(value))
    return true
  }
}
mock.module('../dist/modules/game/game.cache.js', { namedExports: cache })
mock.module('../dist/modules/game/game.repository.js', { namedExports: {
  getSnapshotQuestions: async () => copy(questions),
  flushPlayers: async (rows) => { persisted = copy(rows) },
  updateSessionState: async (_id, patch) => copy(session = { ...session, ...patch })
} })
mock.module('../dist/modules/game/game.service.js', { namedExports: {} })
mock.module('../dist/modules/game/socket.middleware.js', { namedExports: { socketAuth: async () => {} } })
const { GameSocket } = await import('../dist/modules/game/game.socket.js')
const { classicMode } = await import('../dist/modules/game/engine/modes/classic.mode.js')
const { registerMode } = await import('../dist/modules/game/engine/registry.js')
registerMode(classicMode)

function setup({ reveal = true, board = 'between_questions', phase = 'question_active' } = {}) {
  const config = classicMode.defaultConfig()
  config.flow.showCorrectAnswer = reveal
  config.flow.reviewMode = false
  config.flow.showLeaderboard = board
  config.timing.autoAdvance = false
  session = {
    id: 1, quiz_snapshot_id: 1, session_name: 'Test', session_code: 'ABCDEF', session_host: 99,
    total_players: 2, total_questions: 4, session_status: 'active', game_mode: 'classic', config,
    current_question_index: 2, current_phase: phase,
    phase_ends_at: new Date(Date.now() + 30_000).toISOString()
  }
  questions = Array.from({ length: 4 }, (_, index) => ({
    id: 101 + index, quiz_id: 1, question_type: 'multiple_choice', question_text: `Q${index}`,
    question_image: null, time_limit: 30, correct_answer: [0],
    answer_options: [{ id: 0, option_text: 'Yes' }, { id: 1, option_text: 'No' }]
  }))
  players = new Map([1, 2].map((id) => [id, {
    id, game_session_id: 1, player_id: id, player_guest_id: null, player_name: `Player ${id}`,
    player_score: 2000, correct_answers_count: 2, streak: 2, lives: null,
    current_question_index: 0, status: 'connected',
    answered_questions: [0, 1].map((index) => ({
      question_id: 101 + index, question_index: index, answer: 0, is_correct: true,
      is_late: false, time_taken: 1, score_earned: 1000, answered_at: new Date().toISOString()
    }))
  }]))
  slots = new Map()
  persisted = []
  const sockets = [], emissions = []
  let connect
  const nsp = {
    use() {}, on(event, handler) { if (event === 'connection') connect = handler },
    to(room) {
      const excluded = new Set()
      return {
        except(other) { excluded.add(other); return this },
        emit(event, payload) {
          emissions.push({ room, event, payload: copy(payload) })
          for (const socket of sockets) {
            if (socket.rooms.has(room) && ![...excluded].some((r) => socket.rooms.has(r)))
              socket.emit(event, copy(payload))
          }
        }
      }
    }
  }
  const game = new GameSocket({ of: () => nsp })
  function socket(role, id) {
    const s = {
      data: { role, gameId: 1, code: 'ABCDEF', playerSessionId: role === 'player' ? id : undefined },
      rooms: new Set(), messages: [], handlers: new Map(),
      join(room) { this.rooms.add(room) },
      on(event, handler) { this.handlers.set(event, handler) },
      emit(event, payload) { this.messages.push({ event, payload: copy(payload) }) }
    }
    sockets.push(s)
    connect(s)
    return s
  }
  const first = socket('player', 1), second = socket('player', 2), host = socket('host', 99)
  return { game, first, second, host, emissions, socket }
}
const message = (socket, event) => socket.messages.filter((m) => m.event === event).at(-1)?.payload
const stable = ({ serverTime: _time, ...result }) => result

for (const [name, answer, expected] of [['correct', 0, 3], ['wrong', 1, 0]]) {
  test(`${name} answer: receipt ACK, private settled result, reconnect parity and persistence`, async () => {
    const { game, first, second, host } = setup()
    let ack
    await game.onAnswer(first, { answer }, (payload) => { ack = payload })
    assert.equal(ack.accepted, true)
    for (const key of ['isCorrect', 'scoreEarned', 'totalScore', 'streak', 'correct_answer'])
      assert.equal(key in ack, false)
    assert.equal(message(first, 'question:personal-results'), undefined)
    await game.lockQuestion(1, true)
    const result = message(first, 'question:personal-results')
    assert.equal(result.index, 2)
    assert.equal(result.question_id, 103)
    assert.equal(result.streak, expected)
    assert.equal(result.isCorrect, answer === 0)
    assert.equal(result.answered, true)
    assert.equal(result.totalScore, players.get(1).player_score)
    assert.equal(result.scoreEarned, players.get(1).answered_questions.at(-1).score_earned)
    assert.equal(result.nextQuestionAt, null)
    assert.equal(message(host, 'question:personal-results'), undefined)
    assert.equal(message(second, 'question:personal-results').answered, false)
    assert.equal(persisted.find((p) => p.id === 1).streak, expected)
    await game.onSync(first)
    const state = message(first, 'game:state')
    assert.deepEqual(stable(state.personal_result), stable(result))
    assert.equal(state.player.streak, expected)
    assert.equal('streak' in message(first, 'question:results'), false)
    assert.equal('streak' in state.leaderboard[0], false)
  })
}

for (const disconnected of [false, true]) {
  test(`unanswered timeout resets streak and persists it (disconnected=${disconnected})`, async () => {
    const { game, first } = setup()
    if (disconnected) players.get(1).status = 'disconnected'
    await game.lockQuestion(1, true)
    const result = message(first, 'question:personal-results')
    assert.equal(result.answered, false)
    assert.equal(result.isCorrect, null)
    assert.equal(result.scoreEarned, 0)
    assert.equal(result.streak, 0)
    assert.equal(players.get(1).answered_questions.length, 2)
    assert.equal(persisted.find((p) => p.id === 1).streak, 0)
    await game.lockQuestion(1, true) // duplicate close is idempotent
    assert.equal(first.messages.filter((m) => m.event === 'question:personal-results').length, 1)
  })
}

test('too-late answer is rejected; closure resets the unanswered streak', async () => {
  const { game, first } = setup()
  session.phase_ends_at = new Date(Date.now() - 2000).toISOString()
  await assert.rejects(game.onAnswer(first, { answer: 0 }), { code: 'GAME_ANSWER_TOO_LATE' })
  await game.lockQuestion(1, true)
  assert.equal(message(first, 'question:personal-results').streak, 0)
})

test('automatic result window uses 5 seconds and snapshot never mixes in the next question', async () => {
  const { game, first } = setup()
  session.config.timing.autoAdvance = true
  let armedDelay
  game.timer = (_id, delay) => { armedDelay = delay }
  await game.lockQuestion(1, true)
  assert.ok(armedDelay > 4900 && armedDelay <= 5000)
  const result = message(first, 'question:personal-results')
  assert.equal(result.nextQuestionAt, session.phase_ends_at)
  assert.equal(result.index, 2)
  await game.startQuestion(session, 3)
  await game.onSync(first)
  const state = message(first, 'game:state')
  assert.equal(state.index, 3)
  assert.equal(state.personal_result, null)
  assert.equal('streak' in state.player, false)
  assert.deepEqual(state.leaderboard, [])
})

for (const phase of ['countdown', 'question_active', 'question_locked']) {
  test(`sync masks grading and leaderboard during ${phase}, including paused sessions`, async () => {
    const { game, first } = setup({ phase })
    for (const status of ['active', 'paused']) {
      session.session_status = status
      await game.onSync(first)
      const state = message(first, 'game:state')
      assert.equal(state.personal_result, null)
      for (const key of ['streak', 'player_score', 'correct_answers_count'])
        assert.equal(key in state.player, false)
      assert.equal('is_correct' in state.player.answered_questions[0], false)
      assert.equal('score_earned' in state.player.answered_questions[0], false)
      assert.deepEqual(state.leaderboard, [])
    }
  })
}

test('showCorrectAnswer=false hides the private result, grading and live leaderboard', async () => {
  const { game, first } = setup({ reveal: false })
  await game.onAnswer(first, { answer: 0 })
  await game.lockQuestion(1, true)
  assert.equal(message(first, 'question:personal-results'), undefined)
  assert.equal(message(first, 'leaderboard:updated'), undefined)
  assert.equal(message(first, 'question:results').correct_answer, null)
  await game.onSync(first)
  const state = message(first, 'game:state')
  assert.equal(state.personal_result, null)
  assert.equal('streak' in state.player, false)
  assert.equal('is_correct' in state.player.answered_questions.at(-1), false)
  assert.deepEqual(state.leaderboard, [])
})

for (const board of ['never', 'end_only']) {
  test(`personal results do not depend on leaderboard visibility (${board})`, async () => {
    const { game, first } = setup({ board })
    await game.lockQuestion(1, true)
    await game.onSync(first)
    assert.equal(message(first, 'game:state').personal_result.streak, 0)
    assert.deepEqual(message(first, 'game:state').leaderboard, [])
    assert.equal(message(first, 'leaderboard:updated'), undefined)
  })
}

test('pause/resume broadcasts no private or live grading; host retains monitoring', async () => {
  const { game, first, host } = setup()
  await game.onAnswer(first, { answer: 0 })
  await game.onPause(host)
  assert.deepEqual(message(first, 'game:state').leaderboard, [])
  assert.equal(message(first, 'game:state').personal_result, null)
  assert.equal(message(host, 'game:state').leaderboard[0].streak, 3)
  game.timer = () => {}
  await game.onResume(host)
  assert.deepEqual(message(first, 'game:state').leaderboard, [])
  await game.emitLobby(session)
  assert.equal('player_score' in message(first, 'lobby:updated').players[0], false)
})

test('paused result sync retains its question identity without a running deadline', async () => {
  const { game, first, host } = setup()
  await game.lockQuestion(1, true)
  await game.onPause(host)
  await game.onSync(first)
  const result = message(first, 'game:state').personal_result
  assert.equal(result.index, 2)
  assert.equal(result.question_id, 103)
  assert.equal(result.nextQuestionAt, null)
})

test('self-paced sync retains its reveal policy without attaching a Classic result', async () => {
  const { game } = setup()
  session.config.flow.pacing = 'self'
  session.game_mode = 'solo'
  const state = await game.snapshot(session, players.get(1))
  assert.equal(state.player.streak, 2)
  assert.equal(state.player.answered_questions[0].is_correct, true)
  assert.equal(state.personal_result, null)
  assert.deepEqual(state.leaderboard, [])
})

test('a reconnected socket gets only its own settled result through player:sync', async () => {
  const { game, first, socket } = setup()
  await game.onAnswer(first, { answer: 0 })
  await game.lockQuestion(1, true)
  const reconnect = socket('player', 1)
  await game.onLobbyJoin(reconnect)
  assert.deepEqual(stable(message(reconnect, 'game:state').personal_result),
    stable(message(first, 'question:personal-results')))
})

test('timeout waits for an in-flight answer before persisting and revealing the streak', async () => {
  const { game, first } = setup()
  let release, entered
  const waiting = new Promise((resolve) => { entered = resolve })
  const gate = new Promise((resolve) => { release = resolve })
  const original = game.loadPlayer.bind(game)
  game.loadPlayer = async (...args) => {
    entered()
    await gate
    return original(...args)
  }
  const answer = game.onAnswer(first, { answer: 0 })
  await waiting
  const closing = game.lockQuestion(1, true)
  await Promise.resolve()
  assert.equal(message(first, 'question:personal-results'), undefined)
  release()
  await Promise.all([answer, closing])
  assert.equal(message(first, 'question:personal-results').streak, 3)
  assert.equal(persisted.find((p) => p.id === 1).streak, 3)
})

test('all-answered closure completes inside the answer queue without deadlock', async () => {
  const { game, first, second } = setup()
  await Promise.all([game.onAnswer(first, { answer: 0 }), game.onAnswer(second, { answer: 1 })])
  assert.equal(session.current_phase, 'showing_results')
  assert.equal(message(first, 'question:personal-results').streak, 3)
  assert.equal(message(second, 'question:personal-results').streak, 0)
})

test('a correct answer after a missed question starts a new streak at one', async () => {
  const { game, first } = setup()
  await game.lockQuestion(1, true)
  game.timer = () => {}
  await game.startQuestion(session, 3)
  await game.onAnswer(first, { answer: 0 })
  await game.lockQuestion(1, true)
  assert.equal(message(first, 'question:personal-results').index, 3)
  assert.equal(message(first, 'question:personal-results').streak, 1)
})

test('AsyncAPI shares the exact personal result schema between event and snapshot', async () => {
  const { socketSchemas } = await import('../dist/docs/components/socket.doc.js')
  const { gameChannels } = await import('../dist/docs/socket.channels.js')
  const event = gameChannels['question:personal-results'].subscribe.message.payload
  assert.equal(event.$ref, '#/components/schemas/PersonalQuestionResult')
  assert.equal(socketSchemas.GameState.properties.personal_result.$ref, event.$ref)
  const { game, first } = setup()
  await game.lockQuestion(1, true)
  assert.deepEqual(Object.keys(message(first, 'question:personal-results')).sort(),
    Object.keys(socketSchemas.PersonalQuestionResult.properties).sort())
})
