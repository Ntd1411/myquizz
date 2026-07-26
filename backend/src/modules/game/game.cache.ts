import { redisClient as redis } from '../../infrastructure/cache/redis.client.js'
import type { CachedAnswer, GameSessionRow, PlayerSessionRow } from './game.type.js'

const TTL = {
  session: 60 * 60 * 6,
  players: 60 * 60 * 6,
  answers: 60 * 60
} as const

// keys
export const key = {
  session: (gameId: number) => `game:${gameId}:session`,
  players: (gameId: number) => `game:${gameId}:players`,
  leaderboard: (gameId: number) => `game:${gameId}:leaderboard`,
  answers: (gameId: number, qIndex: number) => `game:${gameId}:answers:${qIndex}`,
  codeToId: (code: string) => `game:code:${code.toUpperCase()}`,
  clock: (gameId: number, playerId: number) => `game:${gameId}:clock:${playerId}`
}

// safe function
const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn()
  } catch (e) {
    console.error('[game.cache] Redis error, fallback to DB:', e)
    return fallback
  }
}

// session
export const setSession = async (session: GameSessionRow) =>
  safe(async () => {
    await redis.multi()
      .set(key.session(session.id), JSON.stringify(session), 'EX', TTL.session)
      .set(key.codeToId(session.session_code), String(session.id), 'EX', TTL.session)
      .exec()
  }, undefined)

export const getSession = async (gameId: number) =>
  safe(async () => {
    const raw = await redis.get(key.session(gameId))
    return raw ? (JSON.parse(raw) as GameSessionRow) : null
  }, null)

export const getGameIdByCode = async (code: string) =>
  safe(async () => {
    const id = await redis.get(key.codeToId(code))
    return id ? Number(id) : null
  }, null)

export const patchSession = async (gameId: number, patch: Partial<GameSessionRow>) =>
  safe(async () => {
    const current = await getSession(gameId)
    if (!current) return null
    const next = { ...current, ...patch }
    await redis.set(key.session(gameId), JSON.stringify(next), 'EX', TTL.session)
    return next
  }, null)

// players
export const updatePlayer = async (gameId: number, player: PlayerSessionRow) =>
  safe(async () => {
    await redis.multi()
      .hset(key.players(gameId), String(player.id), JSON.stringify(player))
      .expire(key.players(gameId), TTL.players)
      .zadd(key.leaderboard(gameId), player.player_score, String(player.id))
      .expire(key.leaderboard(gameId), TTL.players)
      .exec()
  }, undefined)

export const getPlayer = async (gameId: number, playerId: number) =>
  safe(async () => {
    const raw = await redis.hget(key.players(gameId), String(playerId))
    return raw ? (JSON.parse(raw) as PlayerSessionRow) : null
  }, null)

export const getPlayers = async (gameId: number) =>
  safe(async () => {
    const all = await redis.hgetall(key.players(gameId))
    const values = Object.values(all)
    if (values.length === 0) return null
    return values.map((v) => JSON.parse(v) as PlayerSessionRow)
  }, null)

export const countPlayers = async (gameId: number) =>
  safe(async () => {
    const n = await redis.hlen(key.players(gameId))
    return n > 0 ? n : null
  }, null)

export const removePlayer = async (gameId: number, playerId: number) =>
  safe(async () => {
    await redis.multi()
      .hdel(key.players(gameId), String(playerId))
      .zrem(key.leaderboard(gameId), String(playerId))
      .exec()
  }, undefined)

// leaderboard
export const getLeaderboard = async (gameId: number, limit = 100) =>
  safe(async () => {
    const raw = await redis.zrevrange(key.leaderboard(gameId), 0, limit - 1, 'WITHSCORES')
    if (raw.length === 0) return null

    const ids: string[] = []
    for (let i = 0; i < raw.length; i += 2) ids.push(raw[i] as string)

    const rows = await redis.hmget(key.players(gameId), ...ids)
    return ids.map((id, i) => {
      const p = rows[i] ? (JSON.parse(rows[i]) as PlayerSessionRow) : null
      return {
        rank: i + 1,
        id: Number(id),
        player_name: p?.player_name ?? '',
        player_score: Number(raw[i * 2 + 1]),
        correct_answers_count: p?.correct_answers_count ?? 0,
        streak: p?.streak ?? 0,
        status: p?.status ?? 'connected'
      }
    })
  }, null)

// answers
// hsetnx = non-atomic set.
export const recordAnswer = async (
  gameId: number,
  qIndex: number,
  playerId: number,
  data: CachedAnswer,
  allowChange = false
) =>
  safe(async () => {
    const k = key.answers(gameId, qIndex)
    const field = String(playerId)
    const payload = JSON.stringify(data)

    let accepted = true
    if (allowChange) await redis.hset(k, field, payload)
    else accepted = (await redis.hsetnx(k, field, payload)) === 1

    await redis.expire(k, TTL.answers)
    return accepted
  }, true)

export const countAnswers = async (gameId: number, qIndex: number) =>
  safe(() => redis.hlen(key.answers(gameId, qIndex)), 0)

// stats for each question (use with question:results)
export const getAnswerStats = async (gameId: number, qIndex: number) =>
  safe(async () => {
    const all = await redis.hgetall(key.answers(gameId, qIndex))
    const answers = Object.values(all).map((v) => JSON.parse(v) as CachedAnswer)
    const distribution: Record<string, number> = {}
    for (const a of answers) {
      const label = String(a.answer)
      distribution[label] = (distribution[label] ?? 0) + 1
    }
    return {
      total: answers.length,
      correct: answers.filter((a) => a.isCorrect).length,
      distribution
    }
  }, { total: 0, correct: 0, distribution: {} })

// cleanup: call after game:ended, after flush Postgres
export const clearGame = async (session: GameSessionRow) =>
  safe(async () => {
    const pipeline = redis.multi()
      .del(key.session(session.id))
      .del(key.players(session.id))
      .del(key.leaderboard(session.id))
      .del(key.codeToId(session.session_code))
    for (let i = 0; i < session.total_questions; i++) {
      pipeline.del(key.answers(session.id, i))
    }
    for (const p of (await getPlayers(session.id)) ?? [])
      pipeline.del(key.clock(session.id, p.id))
    await pipeline.exec()
  }, undefined)

// Per player timing for self-paced modes (solo / practice / marathon)
export interface PlayerClock {
  questionIndex: number
  startedAt: string
  endsAt: string | null // null = no per question limit (practice)
  timeLimit: number
  matchEndsAt: string | null // marathon: whole match deadline
}

export const setPlayerClock = async (gameId: number, playerId: number, clock: PlayerClock) =>
  safe(async () => {
    await redis.set(key.clock(gameId, playerId), JSON.stringify(clock), 'EX', TTL.session)
    return clock
  }, clock)

export const getPlayerClock = async (gameId: number, playerId: number) =>
  safe(async () => {
    const raw = await redis.get(key.clock(gameId, playerId))
    return raw ? (JSON.parse(raw) as PlayerClock) : null
  }, null)
