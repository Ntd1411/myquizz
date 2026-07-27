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
import { seededShuffle } from './game.utils.js'

type Ack = (payload: unknown) => void

// Clock skew allowance used when late answers are NOT allowed
const LATE_GRACE_MS = 1000

const iso = (ms: number) => new Date(ms).toISOString()

// Strip correct_answer before anything leaves the server.
// optionSeed: session.id for host-paced, session.id + player.id for self-paced.
const publicQuestion = (
  q: SnapshotQuestion,
  index: number,
  total: number,
  cfg: GameConfig,
  optionSeed = 0
) => ({
  index,
  total,
  id: q.id,
  question_type: q.question_type,
  question_text: q.question_text,
  question_image: q.question_image,
  question_hint: cfg.flow.showHint ? q.question_hint ?? null : null,
  // grading uses answer_options[].id, so reordering the display is safe for scoring
  answer_options:
    q.answer_options && cfg.flow.shuffleOptions
      ? seededShuffle(q.answer_options, optionSeed + q.id)
      : q.answer_options
})

// config.timing.perQuestionSeconds overrides the question time_limit.
// null = fall back to the question, 0 = explicitly no limit (practice mode).
const limitOf = (q: SnapshotQuestion, cfg: GameConfig): number | null => {
  const configured = cfg.timing.perQuestionSeconds
  if (configured === 0) return null
  if (configured !== null) return configured
  return q.time_limit ?? null
}

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
      this.on(socket, 'lobby:config-update', (p, ack) => this.onConfigUpdate(socket, p, ack))
      this.on(socket, 'game:start', () => this.onStart(socket))
      this.on(socket, 'game:next', () => this.onNext(socket))
      this.on(socket, 'game:pause', () => this.onPause(socket))
      this.on(socket, 'game:resume', () => this.onResume(socket))
      this.on(socket, 'game:end', () => this.onEndByHost(socket))
      this.on(socket, 'question:answer', (p, ack) => this.onAnswer(socket, p, ack))
      this.on(socket, 'player:sync', () => this.onSync(socket))
      this.on(socket, 'game:review', () => this.onReview(socket))

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
    const session = await this.loadSession(gameId)
    const rows = await repo.getSnapshotQuestions(gameId)
    // the session id is a stable seed: every process derives the same order
    const ordered = session.config.flow.shuffleQuestions ? seededShuffle(rows, gameId) : rows
    this.questions.set(gameId, ordered)
    return ordered
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
  // target: omit it to broadcast to the whole room (the roster really changed), or pass a
  // single socket when only that client needs a refresh. A host connecting or reloading
  // changes nothing for the players, so there is no reason to wake the whole room.
  private async emitLobby(session: GameSessionRow, target?: Socket) {
    const players = await this.loadPlayers(session.id)
    const payload = {
      session_status: session.session_status,
      config: session.config,
      players: players.map((p) => ({
        id: p.id,
        player_name: p.player_name,
        player_score: p.player_score,
        lives: p.lives ?? null, // the host screen needs it in survival
        status: p.status
      })),
      serverTime: iso(Date.now())
    }
    if (target) target.emit('lobby:updated', payload)
    else this.nsp.to(this.room(session.session_code)).emit('lobby:updated', payload)
  }

  // One computation, two audiences: players get the lean rows, the host gets everything
  private buildLeaderboard(players: PlayerSessionRow[], totalQuestions: number) {
    const sorted = [...players].sort(
      (a, b) =>
        b.player_score - a.player_score ||
      b.correct_answers_count - a.correct_answers_count ||
      a.id - b.id
    )
    return sorted.map((p, i) => {
      const answered = (p.answered_questions ?? []).length
      const correct = p.correct_answers_count
      const lean = {
        rank: i + 1,
        id: p.id,
        player_name: p.player_name,
        player_score: p.player_score
      }
      return {
        lean,
        full: {
          ...lean,
          answered_count: answered,
          correct_count: correct,
          wrong_count: Math.max(0, answered - correct),
          unanswered_count: Math.max(0, totalQuestions - answered),
          total_questions: totalQuestions,
          current_question_index: p.current_question_index,
          streak: p.streak,
          lives: p.lives ?? null,
          status: p.status
        }
      }
    })
  }

  // forceRoom: used by game:ended so 'end_only' still reaches the players
  // audience decides who gets the lean board:
  //   'auto'      - normal between-question refresh, follows flow.showLeaderboard
  //   'force'     - end of the match, so 'end_only' still reaches the players
  //   'host-only' - a host connected or reloaded: refresh the host screen and nothing else,
  //                 the players' standings did not change so they must not be woken up
  private async emitLeaderboard(
    session: GameSessionRow,
    audience: 'auto' | 'force' | 'host-only' = 'auto'
  ) {
    const players = await this.loadPlayers(session.id)
    const questions = await this.loadQuestions(session.id)
    const rows = this.buildLeaderboard(players, questions.length)
    const serverTime = iso(Date.now())
    const code = session.session_code
    const mode = session.config.flow.showLeaderboard

    // players only ever see rank, name and score
    const toPlayers =
    audience === 'host-only'
      ? false
      : audience === 'force'
        ? mode !== 'never'
        : mode === 'between_questions'

    if (toPlayers)
      this.nsp.to(this.room(code)).except(this.hostRoom(code)).emit('leaderboard:updated', {
        leaderboard: rows.map((r) => r.lean),
        serverTime
      })

    // the host always gets the full monitoring table, whatever the config says
    this.nsp.to(this.hostRoom(code)).emit('leaderboard:host', {
      leaderboard: rows.map((r) => r.full),
      total_questions: questions.length,
      answered_total: rows.reduce((sum, r) => sum + r.full.answered_count, 0),
      serverTime
    })
  }

  // The host screen is a monitor: it must see every phase change, including the
  // self-paced flow where no room-wide question event is ever emitted
  private async emitHostState(session: GameSessionRow) {
    this.nsp.to(this.hostRoom(session.session_code)).emit('game:state', await this.snapshot(session))
  }

  private async onLobbyJoin(socket: Socket) {
    const data = socket.data as CustomSocketData
    if (!data.gameId || !data.code) throw new Error('FORBIDDEN: no room in token')
    void socket.join(this.room(data.code))
    if (data.role === 'host') void socket.join(this.hostRoom(data.code))
    const session = await this.loadSession(data.gameId)

    if (data.role === 'player' && data.playerSessionId) {
      const player = await this.loadPlayer(data.gameId, data.playerSessionId)
      if (player.status === 'disconnected') {
        player.status = 'connected'
        await cache.updatePlayer(session.id, player)
      }
    }

    if (data.role === 'host') {
      // host only refreshes itself: the player roster did not change
      await this.emitLobby(session, socket)
      socket.emit('game:state', await this.snapshot(session))
      await this.emitLeaderboard(session, 'host-only')
    } else if (session.session_status === 'lobby') {
      // a player joined or reconnected: the roster changed, everyone needs it
      await this.emitLobby(session)
    }

    if (session.session_status !== 'active') return

    // still counting down: send the countdown instead of a question
    if (session.current_phase === 'countdown') {
      socket.emit('game:countdown', {
        seconds: session.phase_ends_at
          ? Math.max(0, Math.round((Date.parse(session.phase_ends_at) - Date.now()) / 1000))
          : 0,
        startsAt: session.phase_ends_at,
        serverTime: iso(Date.now())
      })
      return
    }

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

  private async onConfigUpdate(socket: Socket, payload: unknown, ack?: Ack) {
    const { gameId } = this.requireHost(socket)
    const raw = (payload ?? {}) as Record<string, unknown>
    // accept both a wrapped config object and a bare config object
    const patch = (raw.config ?? raw) as unknown
    const { session, ignored, changed } = await gameService.applyConfigPatchFromSocket(gameId, patch)

    // a fully ignored patch changes nothing, so there is nothing to broadcast
    if (changed) {
      await this.emitLobby(session)
      await this.emitHostState(session)
    }
    // echo what the server stored plus every path it refused to take
    if (typeof ack === 'function')
      ack({ ok: true, changed, config: session.config, ignored })
  }

  // start
  private async onStart(socket: Socket) {
    const { gameId } = this.requireHost(socket)
    const current = await this.loadSession(gameId)
    if (current.session_status !== 'lobby') throw new Error('CONFLICT: game already started')

    const cfg = current.config
    const countdown = Math.max(0, cfg.timing.countdownSeconds ?? 0)

    const session = await repo.updateSessionState(gameId, {
      session_status: 'active',
      current_phase: countdown > 0 ? 'countdown' : 'question_active',
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

    if (countdown <= 0) {
      await this.beginFirstQuestion(session, socket)
      return
    }

    const startsAt = iso(Date.now() + countdown * 1000)
    const waiting = await this.patchSession(session.id, {
      current_phase: 'countdown',
      phase_ends_at: startsAt
    })
    this.nsp.to(this.room(waiting.session_code)).emit('game:countdown', {
      seconds: countdown,
      startsAt,
      serverTime: iso(Date.now())
    })
    this.timer(waiting.id, countdown * 1000, async () => {
      const fresh = await this.loadSession(waiting.id)
      await this.beginFirstQuestion(fresh, socket)
    })
  }

  // Shared by the direct start and by the end of the countdown timer
  private async beginFirstQuestion(session: GameSessionRow, socket: Socket) {
    if (session.config.flow.pacing === 'host') {
      await this.startQuestion(session, 0, socket)
      return
    }
    const active = await this.patchSession(session.id, {
      current_phase: 'question_active',
      phase_ends_at: null // self-paced: the deadline lives in the per-player clock
    })
    // self-paced: every connected player starts their own sequence
    const sockets = await this.nsp.in(this.room(active.session_code)).fetchSockets()
    for (const s of sockets) {
      const sd = s.data as CustomSocketData
      if (sd.role === 'player') await this.sendSelfQuestion(s as unknown as Socket, active)
    }
  }

  // host-paced state machine
  private async startQuestion(session: GameSessionRow, index: number, socket: Socket) {
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

    const serverTime = iso(Date.now())
    const shown = publicQuestion(q, index, questions.length, cfg, updated.id)

    this.nsp.to(this.room(updated.session_code)).emit('question:started', {
      question: shown, // correct answer stripped
      time_limit: limit,
      endsAt,
      serverTime
    })

    // the host screen needs the answer key, so it gets its own copy
    this.nsp.to(this.hostRoom(updated.session_code)).emit('host:question', {
      question: shown,
      correct_answer: q.correct_answer, // host room only, never the whole room
      time_limit: limit,
      endsAt,
      total_questions: questions.length,
      serverTime
    })

    await this.emitLeaderboard(updated)
    if (limit !== null) this.timer(updated.id, limit * 1000, () => this.lockQuestion(updated.id, true, socket))
  }

  private async lockQuestion(gameId: number, byTimeUp: boolean, socket: Socket) {
    this.clearTimer(gameId)
    const current = await this.loadSession(gameId)
    if (current.current_phase !== 'question_active') return // already locked
    const session = await this.patchSession(gameId, {
      current_phase: 'question_locked',
      phase_ends_at: null
    })
    this.nsp.to(this.room(session.session_code)).emit('question:locked', {
      index: session.current_question_index,
      reason: byTimeUp ? 'time_up' : 'all_answered',
      serverTime: iso(Date.now())
    })
    await this.showResults(session, socket)
  }

  private async showResults(session: GameSessionRow, socket: Socket) {
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
      stats,
      serverTime: iso(Date.now())
    })

    const players = await this.loadPlayers(session.id)
    await repo.flushPlayers(players) // flush Postgres at the end of every question

    if (cfg.flow.showLeaderboard === 'between_questions') await this.emitLeaderboard(session)
    else if ((socket.data as CustomSocketData).role === 'host') await this.emitLeaderboard(session, 'host-only')

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
      await this.startQuestion(fresh, fresh.current_question_index + 1, socket)
    })
  }

  private async onNext(socket: Socket) {
    const { gameId } = this.requireHost(socket)
    const session = await this.loadSession(gameId)
    if (session.config.flow.pacing !== 'host')
      throw new Error('CONFLICT: self-paced modes have no host advance')
    if (session.session_status !== 'active') throw new Error('CONFLICT: game is not active')

    this.clearTimer(gameId)
    if (session.current_phase === 'question_active') return this.lockQuestion(gameId, false, socket)
    await this.startQuestion(session, session.current_question_index + 1, socket)
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
      this.timer(gameId, remaining, () => this.lockQuestion(gameId, true, socket))
    else if (updated.current_phase === 'showing_results' && updated.config.timing.autoAdvance)
      this.timer(gameId, remaining, async () => {
        const fresh = await this.loadSession(gameId)
        await this.startQuestion(fresh, fresh.current_question_index + 1, socket)
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
    if (session.current_phase === 'countdown')
      throw new Error('CONFLICT: the game has not started yet')

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

    // one answer per question, no exceptions
    if ((player.answered_questions ?? []).some((a) => a.question_index === index))
      throw new Error('CONFLICT: answer already submitted')

    // server authoritative timing
    const clock = selfPaced ? await cache.getPlayerClock(gameId, psid) : null
    const limit = limitOf(q, cfg)
    const now = Date.now()
    let timeTaken: number
    let isLate = false

    if (selfPaced) {
    // marathon: the match budget is a hard stop, allowAnswerLate never extends it
      if (clock?.matchEndsAt && now >= Date.parse(clock.matchEndsAt))
        return this.finishPlayer(socket, session, player)

      const startedAt = clock ? Date.parse(clock.startedAt) : now
      timeTaken = (now - startedAt) / 1000

      const deadline = clock?.endsAt ? Date.parse(clock.endsAt) : null
      if (deadline && now > deadline) {
      // allowAnswerLate: the player may answer whenever they want, it is graded as late
        if (!cfg.flow.allowAnswerLate && now > deadline + LATE_GRACE_MS)
          throw new Error('CONFLICT: time is up for this question')
        isLate = cfg.flow.allowAnswerLate
      }
    } else {
      if (session.current_phase !== 'question_active')
        throw new Error('CONFLICT: question is locked')
      const deadline = session.phase_ends_at ? Date.parse(session.phase_ends_at) : null
      // host-paced ignores allowAnswerLate: the room advances together, only skew is tolerated
      if (deadline && now > deadline + LATE_GRACE_MS)
        throw new Error('CONFLICT: time is up for this question')
      timeTaken = deadline && limit !== null ? Math.max(0, limit - (deadline - now) / 1000) : 0
    }
    // a late answer keeps its real duration for the history, but never feeds the speed bonus
    if (limit !== null && limit > 0 && !isLate) timeTaken = Math.min(timeTaken, limit)

    const isCorrect = grade(q, body.answer)

    // ---------- claim the slot in Redis ----------
    // allowChange: false, so two sockets racing on the same question cannot both win
    const accepted = await cache.recordAnswer(
      gameId, index, psid,
      { answer: body.answer, isCorrect, timeTaken, scoreEarned: 0 },
      false
    )
    if (!accepted) throw new Error('CONFLICT: answer already submitted')

    const handler = getModeHandler(session.game_mode)
    const outcome = handler.evaluateAnswer(
      {
        isCorrect,
        timeTaken,
        timeLimit: limit ?? 0, // 0 = no deadline -> scoring skips the speed bonus
        isLate,
        player: { streak: player.streak, lives: player.lives }
      },
      cfg
    )

    player.player_score += outcome.scoreEarned
    player.streak = outcome.newStreak
    if (isCorrect) player.correct_answers_count += 1
    if (outcome.livesRemaining !== undefined) player.lives = outcome.livesRemaining
    if (outcome.eliminated) player.status = 'eliminated'

    player.answered_questions = [
      ...(player.answered_questions ?? []),
    {
      question_id: q.id,
      question_index: index,
      answer: body.answer,
      is_correct: isCorrect,
      is_late: isLate,
      time_taken: Math.round(timeTaken * 100) / 100,
      score_earned: outcome.scoreEarned,
      answered_at: iso(now)
    } satisfies AnsweredQuestion
    ]
    if (selfPaced) player.current_question_index = index + 1

    await cache.updatePlayer(gameId, player) // Redis now, Postgres at the end of the question
    // rewrite the same slot with the real score once the mode has graded it
    await cache.recordAnswer(
      gameId, index, psid,
      { answer: body.answer, isCorrect, timeTaken, scoreEarned: outcome.scoreEarned },
      true
    )

    const serverTime = iso(Date.now())

    // ---------- ack: every field that tells right from wrong is a reveal ----------
    // isCorrect, scoreEarned, totalScore and streak are each an answer oracle on
    // their own, so they follow flow.showCorrectAnswer just like correct_answer.
    // When it is off, the player learns the outcome from question:results and
    // leaderboard:updated (host-paced) or from game:ended / game:review (self-paced).
    if (typeof ack === 'function') {
      const reveal = cfg.flow.showCorrectAnswer
      ack({
        accepted: true,
        isLate,
        lives: player.lives ?? null,
        eliminated: outcome.eliminated ?? false,
        serverTime,
        ...(reveal
          ? {
            isCorrect,
            scoreEarned: outcome.scoreEarned,
            totalScore: player.player_score,
            streak: player.streak,
            // self-paced has no question:results event, so the ack is the only reveal channel
            correct_answer: selfPaced ? q.correct_answer : undefined
          }
          : {})
      })
    }

    if (outcome.eliminated)
      this.nsp.to(this.room(session.session_code)).emit('player:eliminated', {
        id: player.id,
        player_name: player.player_name,
        serverTime
      })

    const players = await this.loadPlayers(gameId)
    const activePlayers = players.filter((p) => p.status === 'connected').length
    const answered = await cache.countAnswers(gameId, index)

    if (!selfPaced) {
    // the room only learns how many answers arrived, never who was right
      this.nsp.to(this.room(session.session_code)).except(this.hostRoom(session.session_code))
        .emit('answer:received', { index, answered, activePlayers, serverTime })

      this.nsp.to(this.hostRoom(session.session_code)).emit('host:answer-received', {
        index,
        answered,
        activePlayers,
        player: { id: player.id, player_name: player.player_name },
        is_correct: isCorrect, // host room only
        serverTime
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
      if (advance) await this.lockQuestion(gameId, false, socket)
      return
    }

    // ---------- self-paced: only this player moves on ----------
    this.nsp.to(this.hostRoom(session.session_code)).emit('host:player-progress', {
      player: {
        id: player.id,
        player_name: player.player_name,
        current_question_index: player.current_question_index,
        player_score: player.player_score,
        correct_answers_count: player.correct_answers_count,
        status: player.status
      },
      total_questions: questions.length,
      serverTime
    })

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
    // each self-paced player gets their own option order
      question: publicQuestion(q, index, questions.length, cfg, session.id + player.id),
      time_limit: limit,
      endsAt,
      matchEndsAt,
      // the client must know the deadline is soft, so it keeps the inputs enabled
      allow_answer_late: cfg.flow.allowAnswerLate,
      serverTime: iso(Date.now())
    })
  }

  private async finishPlayer(socket: Socket, session: GameSessionRow, player: PlayerSessionRow) {
    if (player.status !== 'eliminated') player.status = 'finished'
    await cache.updatePlayer(session.id, player)
    await repo.flushPlayers([player])

    const serverTime = iso(Date.now())
    const showLeaderboard = session.config.flow.showLeaderboard

    // a single player finishing is not the end of the match: use a dedicated event
    socket.emit('player:finished', {
      player: {
        id: player.id,
        player_score: player.player_score,
        correct_answers_count: player.correct_answers_count,
        status: player.status
      },
      leaderboard: showLeaderboard === 'never' ? [] : await repo.getLeaderboard(session.id),
      serverTime
    })

    this.nsp.to(this.hostRoom(session.session_code)).emit('player:finished', {
      player: {
        id: player.id,
        player_name: player.player_name,
        player_score: player.player_score,
        correct_answers_count: player.correct_answers_count,
        status: player.status
      },
      serverTime
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
    const counting = session.current_phase === 'countdown'

    const inQuestion =
    !counting &&
    (['question_active', 'question_locked', 'showing_results'].includes(session.current_phase) ||
      (selfPaced && session.session_status === 'active'))

    const clock = selfPaced && player ? await cache.getPlayerClock(session.id, player.id) : null
    const endsAt = selfPaced && player && !counting ? clock?.endsAt ?? null : session.phase_ends_at
    const optionSeed = selfPaced && player ? session.id + player.id : session.id

    return {
      session_status: session.session_status,
      current_phase: session.current_phase,
      mode: session.game_mode,
      config: cfg,
      index,
      total_questions: questions.length,
      question: inQuestion && q ? publicQuestion(q, index, questions.length, cfg, optionSeed) : null,
      // reconnecting in the middle of the countdown: no question yet, just the start time
      countdown: counting ? { startsAt: session.phase_ends_at } : null,
      endsAt,
      matchEndsAt: clock?.matchEndsAt ?? null,
      allow_answer_late: selfPaced ? cfg.flow.allowAnswerLate : false,
      remainingSeconds: endsAt
        ? Math.max(0, Math.round((Date.parse(endsAt) - Date.now()) / 1000))
        : null,
      serverTime: iso(Date.now()),
      player: player ?? null,
      leaderboard:
      cfg.flow.showLeaderboard === 'never'
        ? []
        : (await cache.getLeaderboard(session.id)) ?? (await repo.getLeaderboard(session.id))
    }
  }

  private async onReview(socket: Socket) {
    const { gameId, psid } = this.requirePlayer(socket)
    const session = await this.loadSession(gameId)
    if (!session.config.flow.reviewMode) throw new Error('FORBIDDEN: review is disabled')
    if (session.session_status !== 'finished') throw new Error('CONFLICT: game is still running')

    const player = await this.loadPlayer(gameId, psid)
    const questions = await this.loadQuestions(gameId)

    socket.emit('game:review', {
      player_score: player.player_score,
      correct_answers_count: player.correct_answers_count,
      total_questions: questions.length,
      // only the caller's own answers, the id always comes from the socket token
      items: (player.answered_questions ?? []).map((entry) => {
        const q = questions[entry.question_index]
        return {
          question_index: entry.question_index,
          question_text: q?.question_text ?? null,
          question_image: q?.question_image ?? null,
          answer_options: q?.answer_options ?? null,
          explanation: q?.explanation ?? null,
          your_answer: entry.answer,
          correct_answer: q?.correct_answer ?? null,
          is_correct: entry.is_correct,
          is_late: entry.is_late ?? false,
          score_earned: entry.score_earned,
          time_taken: entry.time_taken
        }
      }),
      serverTime: iso(Date.now())
    })
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

    const serverTime = iso(Date.now())
    const showFinal = finished.config.flow.showLeaderboard !== 'never'
    const leaderboard = showFinal ? await repo.getLeaderboard(finished.id) : []
    const perQuestion = await repo.getQuestionStats(finished.id)

    this.nsp.to(this.room(finished.session_code)).except(this.hostRoom(finished.session_code))
      .emit('game:ended', {
        leaderboard,
        perQuestion,
        review_enabled: finished.config.flow.reviewMode,
        serverTime
      })

    // the host always gets the full result table
    this.nsp.to(this.hostRoom(finished.session_code)).emit('game:ended', {
      leaderboard: await repo.getLeaderboard(finished.id),
      perQuestion,
      review_enabled: finished.config.flow.reviewMode,
      serverTime
    })

    await cache.clearGame(finished) // clear Redis only after the flush
    this.questions.delete(finished.id)
  }
}
