import { redisClient as redis } from '../../infrastructure/cache/redis.client.js'
import type { CachedAnswer, GameSessionRow, PlayerSessionRow } from './game.type.js'
import { AppError } from '../../shared/errors/AppError.js'
import { randomUUID } from 'node:crypto'

const TTL = {
  session: 60 * 60 * 6,
  players: 60 * 60 * 6,
  answers: 60 * 60
} as const

// keys
export const key = {
  session: (gameId: number) => `game:${gameId}:session`,
  players: (gameId: number) => `game:${gameId}:players`,
  playersComplete: (gameId: number) => `game:${gameId}:players:complete`,
  leaderboard: (gameId: number) => `game:${gameId}:leaderboard`,
  answers: (gameId: number, qIndex: number) => `game:${gameId}:answers:${qIndex}`,
  answerKeys: (gameId: number) => `game:${gameId}:answer_keys`,
  codeToId: (code: string) => `game:code:${code.toUpperCase()}`,
  clock: (gameId: number, playerId: number) => `game:${gameId}:clock:${playerId}`,
  pausedRemaining: (gameId: number) => `game:${gameId}:paused_remaining`
}

export const requireGameState = () => {
  if (redis.status !== 'ready')
    throw new AppError(503, 'Game state is temporarily unavailable', 'SERVICE_UNAVAILABLE')
}

// Host controls must serialize across sockets, including when they land on
// different server processes. A failed Redis claim stops the transition.
export const withHostTransition = async <T>(gameId: number, work: () => Promise<T>): Promise<T> => {
  requireGameState()
  const lock = `game:${gameId}:host-transition`
  const token = randomUUID()
  let claimed: string | null
  try {
    claimed = await redis.set(lock, token, 'PX', 60_000, 'NX')
  } catch {
    throw new AppError(503, 'Game state is temporarily unavailable', 'SERVICE_UNAVAILABLE')
  }
  if (claimed !== 'OK')
    throw new AppError(409, 'Another host action is in progress', 'GAME_ADVANCE_NOT_ALLOWED')

  try {
    return await work()
  } finally {
    try {
      await redis.eval(
        `if redis.call('GET', KEYS[1]) == ARGV[1] then
           return redis.call('DEL', KEYS[1])
         end
         return 0`,
        1, lock, token
      )
    } catch (error) {
      console.error('[game.cache] Could not release host transition lock:', error)
    }
  }
}

// safe function
const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  if (redis.status !== 'ready') return fallback
  try {
    return await fn()
  } catch (e) {
    console.error('[game.cache] Redis error, fallback to DB:', e)
    return fallback
  }
}

const required = async <T>(fn: () => Promise<T>): Promise<T> => {
  requireGameState()
  try {
    return await fn()
  } catch {
    throw new AppError(503, 'Game state is temporarily unavailable', 'SERVICE_UNAVAILABLE')
  }
}

// session
export const setSession = async (session: GameSessionRow) =>
  required(async () => {
    const result = await redis.multi()
      .set(key.session(session.id), JSON.stringify(session), 'EX', TTL.session)
      .set(key.codeToId(session.session_code), String(session.id), 'EX', TTL.session)
      .exec()
    if (!result || result.some(([error]) => error !== null)) throw new Error('Redis session write failed')
  })

export const warmSession = async (session: GameSessionRow) =>
  safe(() => setSession(session), undefined)

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
  required(async () => {
    const raw = await redis.get(key.session(gameId))
    if (!raw) return null
    const next = { ...(JSON.parse(raw) as GameSessionRow), ...patch }
    await redis.set(key.session(gameId), JSON.stringify(next), 'EX', TTL.session)
    return next
  })

// players
export const updatePlayer = async (gameId: number, player: PlayerSessionRow) =>
  required(async () => {
    const result = await redis.multi()
      .hset(key.players(gameId), String(player.id), JSON.stringify(player))
      .expire(key.players(gameId), TTL.players)
      .zadd(key.leaderboard(gameId), player.player_score, String(player.id))
      .expire(key.leaderboard(gameId), TTL.players)
      .exec()
    if (!result || result.some(([error]) => error !== null)) throw new Error('Redis player write failed')
  })

export const warmPlayer = async (gameId: number, player: PlayerSessionRow) =>
  safe(() => updatePlayer(gameId, player), undefined)

export const getPlayer = async (gameId: number, playerId: number) =>
  safe(async () => {
    const raw = await redis.hget(key.players(gameId), String(playerId))
    return raw ? (JSON.parse(raw) as PlayerSessionRow) : null
  }, null)

export const getPlayers = async (gameId: number) =>
  safe(async () => {
    if (!(await redis.exists(key.playersComplete(gameId)))) return null
    const all = await redis.hgetall(key.players(gameId))
    const values = Object.values(all)
    if (values.length === 0) return null
    return values.map((v) => JSON.parse(v) as PlayerSessionRow)
  }, null)

export const markPlayersComplete = async (gameId: number) => {
  await redis.set(key.playersComplete(gameId), '1', 'EX', TTL.players)
}

export const countPlayers = async (gameId: number) =>
  safe(async () => {
    const n = await redis.hlen(key.players(gameId))
    return n > 0 ? n : null
  }, null)

export const removePlayer = async (gameId: number, playerId: number) =>
  required(async () => {
    const result = await redis.multi()
      .hdel(key.players(gameId), String(playerId))
      .zrem(key.leaderboard(gameId), String(playerId))
      .exec()
    if (!result || result.some(([error]) => error !== null)) throw new Error('Redis player removal failed')
  })

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
// No silent fallback: if Redis is down we cannot guarantee one answer per
// question, so the error must reach the socket error boundary instead of
// letting the same question be scored twice.
export const recordAnswer = async (
  gameId: number,
  qIndex: number,
  playerId: number,
  data: CachedAnswer,
  allowChange = false
) => {
  requireGameState()
  const k = key.answers(gameId, qIndex)
  const field = String(playerId)
  const payload = JSON.stringify(data)

  try {
    const accepted = await redis.eval(
      `local accepted
       if ARGV[3] == '1' then
         redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
         accepted = 1
       else
         accepted = redis.call('HSETNX', KEYS[1], ARGV[1], ARGV[2])
       end
       redis.call('EXPIRE', KEYS[1], ARGV[4])
       redis.call('SADD', KEYS[2], KEYS[1])
       redis.call('EXPIRE', KEYS[2], ARGV[5])
       return accepted`,
      2, k, key.answerKeys(gameId), field, payload, allowChange ? '1' : '0', TTL.answers, TTL.session
    )
    return accepted === 1
  } catch {
    throw new AppError(503, 'Game state is temporarily unavailable', 'SERVICE_UNAVAILABLE')
  }
}

export const countAnswers = async (gameId: number, qIndex: number) =>
  required(() => redis.hlen(key.answers(gameId, qIndex)))

export const setPausedRemaining = async (gameId: number, remainingMs: number) => {
  requireGameState()
  await redis.set(key.pausedRemaining(gameId), String(remainingMs), 'EX', TTL.session)
}

export const getPausedRemaining = async (gameId: number): Promise<number | null> => {
  requireGameState()
  const raw = await redis.get(key.pausedRemaining(gameId))
  return raw === null ? null : Number(raw)
}

export const clearPausedRemaining = async (gameId: number) => {
  await safe(() => redis.del(key.pausedRemaining(gameId)), 0)
}

// stats for each question (use with question:results)
export const getAnswerStats = async (gameId: number, qIndex: number) =>
  required(async () => {
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
  })

// cleanup: call after game:ended, after flush Postgres
export const clearGame = async (session: GameSessionRow) =>
  safe(async () => {
    const pipeline = redis.multi()
      .del(key.session(session.id))
      .del(key.players(session.id))
      .del(key.playersComplete(session.id))
      .del(key.leaderboard(session.id))
      .del(key.pausedRemaining(session.id))
      .del(key.codeToId(session.session_code))
    for (const answerKey of await redis.smembers(key.answerKeys(session.id))) pipeline.del(answerKey)
    pipeline.del(key.answerKeys(session.id))
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
  pausedAt?: string | null
}

export const setPlayerClock = async (gameId: number, playerId: number, clock: PlayerClock) => {
  requireGameState()
  try {
    await redis.set(key.clock(gameId, playerId), JSON.stringify(clock), 'EX', TTL.session)
    return clock
  } catch {
    throw new AppError(503, 'Game clock is temporarily unavailable', 'SERVICE_UNAVAILABLE')
  }
}

export const getPlayerClock = async (gameId: number, playerId: number) =>
  required(async () => {
    const raw = await redis.get(key.clock(gameId, playerId))
    return raw ? (JSON.parse(raw) as PlayerClock) : null
  })
