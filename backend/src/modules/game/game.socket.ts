import type { Namespace, Server, Socket } from 'socket.io'
import { socketAuth, type CustomSocketData } from './socket.middleware.js'
import { getModeHandler } from './engine/registry.js'
import * as cache from './game.cache.js'
import * as repo from './game.repository.js'
import * as gameService from './game.services.js'
import type { GameConfig } from './game.schemas.js'
import type {
  AnsweredQuestion, GameSessionRow, PlayerSessionRow, SnapshotQuestion
} from './game.type.js'

type Ack = (payload: unknown) => void

const iso = (ms: number) => new Date(ms).toISOString()

// Strip correct_answer before anything leaves the server
const publicQuestion = (q: SnapshotQuestion, index: number, total: number) => ({
  index,
  total,
  id: q.id,
  question_type: q.question_type,
  question_text: q.question_text,
  question_image: q.question_image,
  answer_options: q.answer_options
})

// config.timing.perQuestionSeconds overrides the question time_limit, null = no limit
const limitOf = (q: SnapshotQuestion, cfg: GameConfig): number | null =>
  cfg.timing.perQuestionSeconds !== null ? cfg.timing.perQuestionSeconds : q.time_limit ?? null

// Real snapshots store correct_answer as an array of option ids, even for multiple_choice
// (e.g. "correct_answer": [0]), so a scalar client answer must be normalized first.
// Option ids can be 0, which is falsy: never use a truthy check on them.
const normalize = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value])
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map((v) => String(v).trim().toLowerCase())
    .sort()

// Grading runs on the server only
const grade = (q: SnapshotQuestion, answer: unknown): boolean => {
  const want = normalize(q.correct_answer)
  const got = normalize(answer)
  if (want.length === 0 || got.length === 0) return false

  switch (q.question_type) {
  case 'multiple_choice':
    // exactly one option, accepted when it is one of the correct ids
    return got.length === 1 && want.includes(got[0] as string)
  case 'multiple_select':
    // the selected set must match the correct set exactly
    return got.length === want.length && got.every((v, i) => v === want[i])
  default:
    // short_answer / long_answer: a single text answer, several accepted variants allowed
    return got.length === 1 && want.includes(got[0] as string)
  }
}

export class GameSocket {
  private nsp: Namespace
  private timers = new Map<number, NodeJS.Timeout>() // gameId -> current phase timer
  private paused = new Map<number, number>() // gameId -> remaining ms while paused
  private questions = new Map<number, SnapshotQuestion[]>() // gameId -> snapshot questions

  constructor(io: Server) {
    this.nsp = io.of('/game')
    this.init()
  }

  private init() {
    // socketAuth is async -> wrap and void it to match the middleware signature
    this.nsp.use((socket, next) => {
      void socketAuth(socket, next)
    })

    this.nsp.on('connection', (socket: Socket) => {
      const data = socket.data as CustomSocketData
      if (data.code) {
        void socket.join(this.room(data.code))
        if (data.role === 'host') void socket.join(this.hostRoom(data.code))
      }

      this.on(socket, 'lobby:join', () => this.onLobbyJoin(socket))
      this.on(socket, 'lobby:leave', () => this.onLeave(socket))
      this.on(socket, 'lobby:config-update', (p) => this.onConfigUpdate(socket, p))
      this.on(socket, 'game:start', () => this.onStart(socket))
      this.on(socket, 'game:next', () => this.onNext(socket))
      this.on(socket, 'game:pause', () => this.onPause(socket))
      this.on(socket, 'game:resume', () => this.onResume(socket))
      this.on(socket, 'game:end', () => this.onEndByHost(socket))
      this.on(socket, 'question:answer', (p, ack) => this.onAnswer(socket, p, ack))
      this.on(socket, 'player:sync', () => this.onSync(socket))

      socket.on('disconnect', () => {
        this.onLeave(socket).catch((e: unknown) => console.error('[game.socket] disconnect:', e))
      })
    })
  }

  // Single error boundary: a rejected handler must never crash the namespace
  private on(
    socket: Socket,
    event: string,
    handler: (payload: unknown, ack?: Ack) => Promise<void>
  ) {
    socket.on(event, (payload: unknown, ack?: Ack) => {
      handler(payload, ack).catch((e: unknown) => {
        const message = e instanceof Error ? e.message : 'INTERNAL_ERROR'
        console.error(`[game.socket] ${event} failed:`, e)
        if (typeof ack === 'function') ack({ error: message })
        else socket.emit('error', { event, message })
      })
    })
  }

  // rooms
  private room = (code: string) => `game:${code}`
  private hostRoom = (code: string) => `game:${code}:host`

  // state helpers (Redis first, Postgres as the fallback)
  private async loadSession(gameId: number): Promise<GameSessionRow> {
    const session = (await cache.getSession(gameId)) ?? (await repo.getSessionById(gameId))
    if (!session) throw new Error('GONE: room not found')
    return session
  }

  private async loadPlayers(gameId: number): Promise<PlayerSessionRow[]> {
    const hot = await cache.getPlayers(gameId)
    if (hot) return hot
    const rows = await repo.listPlayerSessions(gameId) // re-warm after a Redis restart
    for (const p of rows) await cache.updatePlayer(gameId, p)
    return rows
  }

  private async loadPlayer(gameId: number, playerId: number): Promise<PlayerSessionRow> {
    const player =
      (await cache.getPlayer(gameId, playerId)) ?? (await repo.getPlayerSession(playerId))
    if (!player || player.game_session_id !== gameId) throw new Error('GONE: player not in room')
    return player
  }

  private async loadQuestions(gameId: number): Promise<SnapshotQuestion[]> {
    const hit = this.questions.get(gameId)
    if (hit) return hit
    const rows = await repo.getSnapshotQuestions(gameId)
    this.questions.set(gameId, rows)
    return rows
  }

  // hot fields go to Redis; if the cache is cold, write Postgres and re-warm
  private async patchSession(gameId: number, patch: repo.SessionStatePatch): Promise<GameSessionRow> {
    const hot = await cache.patchSession(gameId, patch)
    if (hot) return hot
    const session = await repo.updateSessionState(gameId, patch)
    await cache.setSession(session)
    return session
  }

  // guards: identity always comes from the socket token
  private requireHost(socket: Socket): { data: CustomSocketData; gameId: number } {
    const data = socket.data as CustomSocketData
    if (data.role !== 'host' || !data.gameId) throw new Error('FORBIDDEN: host only')
    return { data, gameId: data.gameId }
  }

  private requirePlayer(socket: Socket): { gameId: number; psid: number } {
    const data = socket.data as CustomSocketData
    // never read a playerId from the client payload
    if (data.role !== 'player' || !data.playerSessionId || !data.gameId)
      throw new Error('FORBIDDEN: player only')
    return { gameId: data.gameId, psid: data.playerSessionId }
  }

  // phase timers
  private timer(gameId: number, delayMs: number, fn: () => Promise<void>) {
    this.clearTimer(gameId)
    const handle = setTimeout(() => {
      this.timers.delete(gameId)
      fn().catch((e: unknown) => console.error('[game.socket] phase timer failed:', e))
    }, Math.max(0, delayMs))
    this.timers.set(gameId, handle)
  }

  private clearTimer(gameId: number) {
    const handle = this.timers.get(gameId)
    if (handle) clearTimeout(handle)
    this.timers.delete(gameId)
  }

  // lobby
  private async emitLobby(session: GameSessionRow) {
    const players = await this.loadPlayers(session.id)
    this.nsp.to(this.room(session.session_code)).emit('lobby:updated', {
      session_status: session.session_status,
      config: session.config,
      players: players.map((p) => ({
        id: p.id, player_name: p.player_name, player_score: p.player_score, status: p.status
      }))
    })
  }

  private async emitLeaderboard(session: GameSessionRow) {
    const leaderboard =
      (await cache.getLeaderboard(session.id)) ?? (await repo.getLeaderboard(session.id))
    this.nsp.to(this.room(session.session_code)).emit('leaderboard:updated', { leaderboard })
  }

  private async onLobbyJoin(socket: Socket) {
    const data = socket.data as CustomSocketData
    if (!data.gameId || !data.code) throw new Error('FORBIDDEN: no room in token')
    void socket.join(this.room(data.code))
    const session = await this.loadSession(data.gameId)

    if (data.role === 'player' && data.playerSessionId) {
      const player = await this.loadPlayer(data.gameId, data.playerSessionId)
      if (player.status === 'disconnected') {
        player.status = 'connected'
        await cache.updatePlayer(session.id, player)
      }
    }
    if (data.role !== 'host')
      await this.emitLobby(session)

    if (session.session_status !== 'active') return
    // a self-paced room that is already running: hand this player their own question
    if (session.config.flow.pacing === 'self' && data.role === 'player')
      await this.sendSelfQuestion(socket, session)
    else await this.onSync(socket)
  }

  private async onLeave(socket: Socket) {
    const data = socket.data as CustomSocketData
    if (!data.gameId || !data.code) return
    if (data.role === 'player' && data.playerSessionId) {
      const player = await cache.getPlayer(data.gameId, data.playerSessionId)
      if (player && player.status === 'connected') {
        player.status = 'disconnected' // keep the row: the player may reconnect with the same token
        await cache.updatePlayer(data.gameId, player)
      }
    }
    void socket.leave(this.room(data.code))
    const session = await cache.getSession(data.gameId)
    if (session && data.role !== 'host') await this.emitLobby(session)
  }

  private async onConfigUpdate(socket: Socket, payload: unknown) {
    const { gameId } = this.requireHost(socket)
    const patch = (payload as { config?: Partial<GameConfig> } | null)?.config ?? {}
    const updated = await gameService.applyConfigPatchFromSocket(gameId, patch)
    await this.emitLobby(updated)
  }

  // start
  private async onStart(socket: Socket) {
    const { gameId } = this.requireHost(socket)
    const current = await this.loadSession(gameId)
    if (current.session_status !== 'lobby') throw new Error('CONFLICT: game already started')

    const hostPaced = current.config.flow.pacing === 'host'
    const session = await repo.updateSessionState(gameId, {
      session_status: 'active',
      current_phase: hostPaced ? 'question_active' : 'active',
      current_question_index: 0,
      started_at: iso(Date.now())
    })
    await cache.setSession(session)

    this.nsp.to(this.room(session.session_code)).emit('game:started', {
      mode: session.game_mode,
      config: session.config,
      total_questions: session.total_questions,
      serverTime: iso(Date.now())
    })

    if (hostPaced) {
      await this.startQuestion(session, 0)
      return
    }
    // self-paced: every connected player starts their own sequence
    const sockets = await this.nsp.in(this.room(session.session_code)).fetchSockets()
    for (const s of sockets) {
      const sd = s.data as CustomSocketData
      if (sd.role === 'player') await this.sendSelfQuestion(s as unknown as Socket, session)
    }
  }

  // host-paced state machine
  private async startQuestion(session: GameSessionRow, index: number) {
    const questions = await this.loadQuestions(session.id)
    const q = questions[index]
    if (!q) return this.endGame(session)

    const cfg = session.config
    const limit = limitOf(q, cfg)
    const endsAt = limit === null ? null : iso(Date.now() + limit * 1000)
    const updated = await this.patchSession(session.id, {
      current_question_index: index,
      current_phase: 'question_active',
      phase_ends_at: endsAt
    })

    this.nsp.to(this.room(updated.session_code)).emit('question:started', {
      question: publicQuestion(q, index, questions.length), // correct answer stripped
      time_limit: limit,
      endsAt,
      serverTime: iso(Date.now())
    })
    if (limit !== null) this.timer(updated.id, limit * 1000, () => this.lockQuestion(updated.id, true))
  }

  private async lockQuestion(gameId: number, byTimeUp: boolean) {
    this.clearTimer(gameId)
    const current = await this.loadSession(gameId)
    if (current.current_phase !== 'question_active') return // already locked
    const session = await this.patchSession(gameId, {
      current_phase: 'question_locked',
      phase_ends_at: null
    })
    this.nsp.to(this.room(session.session_code)).emit('question:locked', {
      index: session.current_question_index,
      reason: byTimeUp ? 'time_up' : 'all_answered'
    })
    await this.showResults(session)
  }

  private async showResults(session: GameSessionRow) {
    const cfg = session.config
    const index = session.current_question_index
    const questions = await this.loadQuestions(session.id)
    const q = questions[index]
    const stats = await cache.getAnswerStats(session.id, index)

    // the correct answer is revealed only after the question is locked
    this.nsp.to(this.room(session.session_code)).emit('question:results', {
      index,
      question_id: q?.id ?? null,
      correct_answer: cfg.flow.showCorrectAnswer ? q?.correct_answer ?? null : null,
      stats
    })

    const players = await this.loadPlayers(session.id)
    await repo.flushPlayers(players) // flush Postgres at the end of every question

    if (cfg.flow.showLeaderboard === 'between_questions') await this.emitLeaderboard(session)

    const handler = getModeHandler(session.game_mode)
    const activePlayers = players.filter((p) => p.status === 'connected').length
    const over = handler.isGameOver(
      {
        activePlayers,
        noMoreQuestions: index + 1 >= questions.length,
        allAnswered: true,
        timeUp: true
      },
      cfg
    )
    if (over) return this.endGame(session)

    const wait = cfg.timing.showResultsSeconds * 1000
    const next = await this.patchSession(session.id, {
      current_phase: 'showing_results',
      phase_ends_at: iso(Date.now() + wait)
    })
    if (!cfg.timing.autoAdvance) return // wait for the host to send game:next
    this.timer(next.id, wait, async () => {
      const fresh = await this.loadSession(next.id)
      await this.startQuestion(fresh, fresh.current_question_index + 1)
    })
  }

  private async onNext(socket: Socket) {
    const { gameId } = this.requireHost(socket)
    const session = await this.loadSession(gameId)
    if (session.config.flow.pacing !== 'host')
      throw new Error('CONFLICT: self-paced modes have no host advance')
    if (session.session_status !== 'active') throw new Error('CONFLICT: game is not active')

    this.clearTimer(gameId)
    if (session.current_phase === 'question_active') return this.lockQuestion(gameId, false)
    await this.startQuestion(session, session.current_question_index + 1)
  }

  private async onPause(socket: Socket) {
    const { gameId } = this.requireHost(socket)
    const session = await this.loadSession(gameId)
    if (session.session_status !== 'active') throw new Error('CONFLICT: game is not active')

    const remaining = session.phase_ends_at ? Date.parse(session.phase_ends_at) - Date.now() : 0
    this.paused.set(gameId, Math.max(0, remaining)) // keep the leftover time of the current phase
    this.clearTimer(gameId)

    const updated = await this.patchSession(gameId, { session_status: 'paused', phase_ends_at: null })
    await repo.updateSessionState(gameId, { session_status: 'paused' })
    this.nsp.to(this.room(updated.session_code)).emit('game:state', await this.snapshot(updated))
  }

  private async onResume(socket: Socket) {
    const { gameId } = this.requireHost(socket)
    const session = await this.loadSession(gameId)
    if (session.session_status !== 'paused') throw new Error('CONFLICT: game is not paused')

    const remaining = this.paused.get(gameId) ?? 0
    this.paused.delete(gameId)
    const endsAt = remaining > 0 ? iso(Date.now() + remaining) : null
    const updated = await this.patchSession(gameId, { session_status: 'active', phase_ends_at: endsAt })
    await repo.updateSessionState(gameId, { session_status: 'active' })
    this.nsp.to(this.room(updated.session_code)).emit('game:state', await this.snapshot(updated))

    if (remaining <= 0) return
    if (updated.current_phase === 'question_active')
      this.timer(gameId, remaining, () => this.lockQuestion(gameId, true))
    else if (updated.current_phase === 'showing_results' && updated.config.timing.autoAdvance)
      this.timer(gameId, remaining, async () => {
        const fresh = await this.loadSession(gameId)
        await this.startQuestion(fresh, fresh.current_question_index + 1)
      })
  }

  private async onEndByHost(socket: Socket) {
    const { gameId } = this.requireHost(socket)
    await this.endGame(await this.loadSession(gameId))
  }

  // answering
  private async onAnswer(socket: Socket, payload: unknown, ack?: Ack) {
    const { gameId, psid } = this.requirePlayer(socket)
    const session = await this.loadSession(gameId)
    if (session.session_status !== 'active') throw new Error('CONFLICT: game is not active')

    const cfg = session.config
    const player = await this.loadPlayer(gameId, psid)
    if (player.status === 'eliminated' || player.status === 'finished')
      throw new Error('CONFLICT: player can not answer anymore')

    const body = (payload ?? {}) as { answer?: unknown }
    const questions = await this.loadQuestions(gameId)
    const selfPaced = cfg.flow.pacing === 'self'
    const index = selfPaced ? player.current_question_index : session.current_question_index
    const q = questions[index]
    if (!q) throw new Error('CONFLICT: no active question')

    // server authoritative timing
    const clock = selfPaced ? await cache.getPlayerClock(gameId, psid) : null
    const limit = limitOf(q, cfg) ?? 0
    let timeTaken: number
    if (selfPaced) {
      if (clock?.endsAt && Date.now() > Date.parse(clock.endsAt) + 1000)
        throw new Error('CONFLICT: time is up for this question')
      const startedAt = clock ? Date.parse(clock.startedAt) : Date.now()
      timeTaken = (Date.now() - startedAt) / 1000
    } else {
      if (session.current_phase !== 'question_active') throw new Error('CONFLICT: question is locked')
      const endsAt = session.phase_ends_at ? Date.parse(session.phase_ends_at) : null
      if (endsAt && Date.now() > endsAt + 1000)
        throw new Error('CONFLICT: time is up for this question')
      timeTaken = endsAt ? Math.max(0, limit - (endsAt - Date.now()) / 1000) : 0
    }
    if (limit > 0) timeTaken = Math.min(timeTaken, limit)

    const isCorrect = grade(q, body.answer)

    // hsetnx based dedupe first, the score is written back right after it is computed
    const accepted = await cache.recordAnswer(
      gameId, index, psid,
      { answer: body.answer, isCorrect, timeTaken, scoreEarned: 0 },
      cfg.flow.allowAnswerChange
    )
    if (!accepted) throw new Error('CONFLICT: answer already submitted')

    const handler = getModeHandler(session.game_mode)
    const outcome = handler.evaluateAnswer(
      {
        isCorrect,
        timeTaken,
        timeLimit: limit > 0 ? limit : 1,
        player: { streak: player.streak, lives: player.lives }
      },
      cfg
    )

    player.player_score += outcome.scoreEarned
    player.streak = outcome.newStreak
    if (isCorrect) player.correct_answers_count += 1
    if (outcome.livesRemaining !== undefined) player.lives = outcome.livesRemaining
    if (outcome.eliminated) player.status = 'eliminated'

    const entry: AnsweredQuestion = {
      question_id: q.id,
      question_index: index,
      answer: body.answer,
      is_correct: isCorrect,
      time_taken: Math.round(timeTaken * 100) / 100,
      score_earned: outcome.scoreEarned,
      answered_at: iso(Date.now())
    }
    player.answered_questions = [...(player.answered_questions ?? []), entry]
    if (selfPaced) player.current_question_index = index + 1

    await cache.updatePlayer(gameId, player) // Redis now, Postgres at the end of the question
    await cache.recordAnswer(
      gameId, index, psid,
      { answer: body.answer, isCorrect, timeTaken, scoreEarned: outcome.scoreEarned },
      true
    )

    if (typeof ack === 'function')
      ack({
        isCorrect,
        scoreEarned: outcome.scoreEarned,
        totalScore: player.player_score,
        streak: player.streak,
        lives: player.lives ?? null,
        eliminated: outcome.eliminated ?? false
      })

    if (outcome.eliminated)
      this.nsp.to(this.room(session.session_code)).emit('player:eliminated', {
        id: player.id, player_name: player.player_name
      })

    const players = await this.loadPlayers(gameId)
    const activePlayers = players.filter((p) => p.status === 'connected').length
    const answered = await cache.countAnswers(gameId, index)

    if (!selfPaced) {
      // only the number of submissions, never who was right
      this.nsp.to(this.room(session.session_code)).emit('answer:received', {
        index, answered, activePlayers
      })
      const advance = handler.shouldAdvance(
        {
          activePlayers,
          noMoreQuestions: index + 1 >= questions.length,
          allAnswered: answered >= activePlayers,
          timeUp: false
        },
        cfg
      )
      if (advance) await this.lockQuestion(gameId, false)
      return
    }

    // self-paced: only this player moves on
    const matchTimeUp = clock?.matchEndsAt ? Date.now() >= Date.parse(clock.matchEndsAt) : false
    const over = handler.isGameOver(
      {
        activePlayers,
        noMoreQuestions: player.current_question_index >= questions.length,
        allAnswered: true,
        timeUp: false,
        matchTimeUp
      },
      cfg
    )
    if (over || outcome.eliminated) return this.finishPlayer(socket, session, player)
    await this.sendSelfQuestion(socket, session)
  }

  // self-paced flow
  private async sendSelfQuestion(socket: Socket, session: GameSessionRow) {
    const data = socket.data as CustomSocketData
    if (!data.playerSessionId) return
    const player = await this.loadPlayer(session.id, data.playerSessionId)
    const questions = await this.loadQuestions(session.id)
    const cfg = session.config
    const index = player.current_question_index

    const previous = await cache.getPlayerClock(session.id, player.id)
    // marathon: the match budget starts when the player receives their first question
    const matchEndsAt =
      previous?.matchEndsAt ??
      (cfg.timing.totalMatchSeconds ? iso(Date.now() + cfg.timing.totalMatchSeconds * 1000) : null)

    if (matchEndsAt && Date.now() >= Date.parse(matchEndsAt))
      return this.finishPlayer(socket, session, player)

    const q = questions[index]
    if (!q) return this.finishPlayer(socket, session, player)

    const limit = limitOf(q, cfg)
    const endsAt = limit === null ? null : iso(Date.now() + limit * 1000)
    await cache.setPlayerClock(session.id, player.id, {
      questionIndex: index,
      startedAt: iso(Date.now()),
      endsAt,
      timeLimit: limit ?? 0,
      matchEndsAt
    })

    socket.emit('question:started', {
      question: publicQuestion(q, index, questions.length),
      time_limit: limit,
      endsAt,
      matchEndsAt,
      serverTime: iso(Date.now())
    })
  }

  private async finishPlayer(socket: Socket, session: GameSessionRow, player: PlayerSessionRow) {
    if (player.status !== 'eliminated') player.status = 'finished'
    await cache.updatePlayer(session.id, player)
    await repo.flushPlayers([player])

    socket.emit('game:ended', {
      player: {
        id: player.id,
        player_score: player.player_score,
        correct_answers_count: player.correct_answers_count,
        status: player.status
      },
      leaderboard: await repo.getLeaderboard(session.id)
    })
    await this.emitLeaderboard(session)

    const players = await this.loadPlayers(session.id)
    const stillPlaying = players.some((p) => p.status !== 'finished' && p.status !== 'eliminated')
    if (!stillPlaying) await this.endGame(session)
  }

  // reconnect
  private async snapshot(session: GameSessionRow, player?: PlayerSessionRow) {
    const cfg = session.config
    const questions = await this.loadQuestions(session.id)
    const selfPaced = cfg.flow.pacing === 'self'
    const index = selfPaced && player ? player.current_question_index : session.current_question_index
    const q = questions[index]

    const inQuestion =
      ['question_active', 'question_locked', 'showing_results'].includes(session.current_phase) ||
      (selfPaced && session.session_status === 'active')

    const clock = selfPaced && player ? await cache.getPlayerClock(session.id, player.id) : null
    const endsAt = selfPaced && player ? clock?.endsAt ?? null : session.phase_ends_at

    return {
      session_status: session.session_status,
      current_phase: session.current_phase,
      mode: session.game_mode,
      config: cfg,
      index,
      total_questions: questions.length,
      question: inQuestion && q ? publicQuestion(q, index, questions.length) : null,
      endsAt,
      matchEndsAt: clock?.matchEndsAt ?? null,
      remainingSeconds: endsAt
        ? Math.max(0, Math.round((Date.parse(endsAt) - Date.now()) / 1000))
        : null,
      serverTime: iso(Date.now()),
      player: player ?? null,
      leaderboard:
        (await cache.getLeaderboard(session.id)) ?? (await repo.getLeaderboard(session.id))
    }
  }

  private async onSync(socket: Socket) {
    const data = socket.data as CustomSocketData
    if (!data.gameId) throw new Error('FORBIDDEN: no room in token')
    const session = await this.loadSession(data.gameId)
    const player =
      data.role === 'player' && data.playerSessionId
        ? await this.loadPlayer(session.id, data.playerSessionId)
        : undefined
    socket.emit('game:state', await this.snapshot(session, player))
  }

  // end of match
  private async endGame(session: GameSessionRow) {
    this.clearTimer(session.id)
    this.paused.delete(session.id)

    const players = await this.loadPlayers(session.id)
    await repo.flushPlayers(players) // final flush: Postgres is the source of truth
    const finished = await repo.updateSessionState(session.id, {
      session_status: 'finished',
      current_phase: 'finished',
      phase_ends_at: null,
      finished_at: iso(Date.now())
    })

    this.nsp.to(this.room(finished.session_code)).emit('game:ended', {
      leaderboard: await repo.getLeaderboard(finished.id),
      perQuestion: await repo.getQuestionStats(finished.id)
    })

    await cache.clearGame(finished) // clear Redis only after the flush
    this.questions.delete(finished.id)
  }
}
