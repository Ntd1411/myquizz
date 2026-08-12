import { pool, withTransaction } from '../../infrastructure/database/connection.js'
import { generateSessionCode } from './game.util.js'
import type { GameConfig } from './game.schema.js'
import type { GameSessionRow, PlayerSessionRow, LeaderboardRow, QuestionStatRow, AnsweredQuestion, SnapshotQuestion } from './game.type.js'
import { AppError } from '../../shared/errors/AppError.js'

// Quiz snapshot: snapshot the quiz at the time of game creation
export const createQuizSnapshot = async (quizId: number) => {
  const { rows } = await pool.query<{ id: number; total_questions: number }>(
    `INSERT INTO quiz_snapshots (quiz_id, snapshot_data, total_questions)
     SELECT
       q.id,
       jsonb_build_object(
         'quiz', to_jsonb(q),
         'questions', coalesce(jsonb_agg(to_jsonb(qs) ORDER BY qs.id), '[]'::jsonb)
       ),
       count(qs.id)
     FROM quizzes q
     LEFT JOIN questions qs ON qs.quiz_id = q.id
     WHERE q.id = $1
     GROUP BY q.id
     RETURNING id, total_questions`,
    [quizId]
  )
  if (!rows[0]) throw new AppError(404, `Quiz #${quizId} not found`)
  return rows[0]
}

// Check session code exists
export const checkSessionCodeExists = async (code: string) => {
  const { rows } = await pool.query<{ exists: boolean }>(`
    SELECT EXISTS (SELECT 1 FROM game_sessions
      WHERE session_code = $1
      AND deleted_at IS NULL
      AND session_status IN ('lobby', 'active', 'paused'))
  `, [code])
  return rows[0]?.exists ?? false
}

// ---------- Game session ----------
export const createGameSession = async (data: {
  quiz_snapshot_id: number
  session_name: string
  session_host: number
  game_mode: string
  config: GameConfig
  total_questions: number
}): Promise<GameSessionRow> => {
  let sessionCode = generateSessionCode()
  while (await checkSessionCodeExists(sessionCode)) {
    sessionCode = generateSessionCode()
  }

  const { rows } = await pool.query<GameSessionRow>(
    `INSERT INTO game_sessions
           (quiz_snapshot_id, session_name, session_code, session_host,
            game_mode, config, total_questions)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
    [data.quiz_snapshot_id, data.session_name, sessionCode, data.session_host,
      data.game_mode, JSON.stringify(data.config), data.total_questions]
  )
  if (!rows[0]) throw new Error('Failed to create game session')
  return rows[0]
}

export const getSessionByCode = async (code: string) => {
  const { rows } = await pool.query<GameSessionRow>(
    'SELECT * FROM game_sessions WHERE session_code = $1 AND deleted_at IS NULL',
    [code]
  )
  return rows[0] ?? null
}

export const getSessionById = async (id: number) => {
  const { rows } = await pool.query<GameSessionRow>(
    'SELECT * FROM game_sessions WHERE id = $1 AND deleted_at IS NULL',
    [id]
  )
  return rows[0] ?? null
}

export const updateSessionConfig = async (id: number, config: GameConfig): Promise<GameSessionRow> => {
  const { rows } = await pool.query<GameSessionRow>(
    `UPDATE game_sessions SET config = $2, updated_at = now()
      WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(config)]
  )
  if (!rows[0]) throw new Error('Failed to update game session config')
  return rows[0]
}

// ---------- Player session ----------
export const countPlayers = async (gameSessionId: number) => {
  const { rows } = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM player_sessions
      WHERE game_session_id = $1 AND deleted_at IS NULL`,
    [gameSessionId]
  )
  return rows[0]?.n
}

export const getPlayerSession = async (id: number) => {
  const { rows } = await pool.query<PlayerSessionRow>(
    'SELECT * FROM player_sessions WHERE id = $1 AND deleted_at IS NULL',
    [id]
  )
  return rows[0] ?? null
}

export const getPlayerSessionBySessionAndPlayer = async (sessionId: number, playerId: number) => {
  const { rows } = await pool.query<PlayerSessionRow>(
    `SELECT * FROM player_sessions
     WHERE game_session_id = $1
     AND player_id = $2
     AND deleted_at IS NULL`,
    [sessionId, playerId]
  )
  return rows[0] ?? null
}

export const getPlayerSessionBySessionAndGuest = async (sessionId: number, playerGuestId: string) => {
  const { rows } = await pool.query<PlayerSessionRow>(
    `SELECT * FROM player_sessions
     WHERE game_session_id = $1
     AND player_guest_id = $2
     AND deleted_at IS NULL`,
    [sessionId, playerGuestId]
  )
  return rows[0] ?? null
}

export const listPlayers = async (gameSessionId: number) => {
  const { rows } = await pool.query<Pick<PlayerSessionRow, 'id' | 'player_name' | 'player_score' | 'status'>>(
    `SELECT id, player_name, player_score, status
       FROM player_sessions
      WHERE game_session_id = $1 AND deleted_at IS NULL
      ORDER BY created_at ASC`,
    [gameSessionId]
  )
  return rows
}

export const createPlayerSession = async (data: {
  game_session_id: number
  player_id: number | null
  player_guest_id: string | null
  player_name: string
  lives: number | null
}): Promise<PlayerSessionRow> =>
  withTransaction(async (tx) => {
    const { rows } = await tx.query<PlayerSessionRow>(
      `INSERT INTO player_sessions
         (game_session_id, player_id, player_guest_id, player_name, lives)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.game_session_id, data.player_id, data.player_guest_id, data.player_name, data.lives]
    )
    await tx.query(
      'UPDATE game_sessions SET total_players = total_players + 1 WHERE id = $1',
      [data.game_session_id]
    )
    if (!rows[0]) throw new Error('Failed to create player session')
    return rows[0]
  })

// ---------- Leaderboard / results ----------
export const getLeaderboard = async (gameSessionId: number) => {
  const { rows } = await pool.query<LeaderboardRow>(
    `SELECT id, player_name, player_score, correct_answers_count, streak, status
       FROM player_sessions
      WHERE game_session_id = $1 AND deleted_at IS NULL
      ORDER BY player_score DESC, correct_answers_count DESC`,
    [gameSessionId]
  )
  return rows.map((r, i) => ({ rank: i + 1, ...r }))
}

// Get stats of each question: number of answers and correct answers
export const getQuestionStats = async (gameSessionId: number) => {
  const { rows } = await pool.query<QuestionStatRow>(
    `SELECT
        (ans->>'question_id')::int              AS question_id,
        count(*)::int                           AS answer_count,
        (count(*) FILTER (WHERE (ans->>'is_correct')::boolean))::int AS correct_count
     FROM player_sessions ps,
          jsonb_array_elements(ps.answered_questions) AS ans
     WHERE ps.game_session_id = $1 AND ps.deleted_at IS NULL
     GROUP BY (ans->>'question_id')::int
     ORDER BY question_id`,
    [gameSessionId]
  )
  return rows
}

// Snapshot questions: source of truth for the questions of a running match
export const getSnapshotQuestions = async (gameSessionId: number): Promise<SnapshotQuestion[]> => {
  const sql =
    'SELECT coalesce(qs.snapshot_data->\'questions\', \'[]\'::jsonb) AS questions ' +
    'FROM game_sessions gs JOIN quiz_snapshots qs ON qs.id = gs.quiz_snapshot_id ' +
    'WHERE gs.id = $1 AND gs.deleted_at IS NULL'
  const { rows } = await pool.query<{ questions: SnapshotQuestion[] }>(sql, [gameSessionId])
  return rows[0]?.questions ?? []
}

// Full player rows (listPlayers only returns the lobby projection)
export const listPlayerSessions = async (gameSessionId: number): Promise<PlayerSessionRow[]> => {
  const sql =
    'SELECT * FROM player_sessions WHERE game_session_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC'
  const { rows } = await pool.query<PlayerSessionRow>(sql, [gameSessionId])
  return rows
}

// Session state: phase / status / index / timestamps
export type SessionStatePatch = Partial<
  Pick<GameSessionRow, 'session_status' | 'current_phase' | 'phase_ends_at' | 'current_question_index'>
> & { started_at?: string | null; finished_at?: string | null }

const SESSION_STATE_COLUMNS = [
  'session_status', 'current_phase', 'phase_ends_at',
  'current_question_index', 'started_at', 'finished_at'
] as const

export const updateSessionState = async (
  id: number, patch: SessionStatePatch
): Promise<GameSessionRow> => {
  const sets: string[] = []
  const values: unknown[] = [id]
  for (const column of SESSION_STATE_COLUMNS) {
    const value = patch[column]
    if (value === undefined) continue
    values.push(value)
    sets.push(`${column} = $${values.length}`) // whitelisted column names only
  }
  if (sets.length === 0) {
    const current = await getSessionById(id)
    if (!current) throw new AppError(404, 'Room not found')
    return current
  }
  const sql =
    'UPDATE game_sessions SET ' + sets.join(', ') + ', updated_at = now() WHERE id = $1 RETURNING *'
  const { rows } = await pool.query<GameSessionRow>(sql, values)
  if (!rows[0]) throw new AppError(404, 'Room not found')
  return rows[0]
}

// Flush the hot player state from Redis into Postgres
export const flushPlayers = async (players: PlayerSessionRow[]): Promise<void> => {
  if (players.length === 0) return
  const sql =
    'UPDATE player_sessions SET player_score = $2, correct_answers_count = $3, streak = $4, ' +
    'lives = $5, current_question_index = $6, status = $7, answered_questions = $8, updated_at = now() ' +
    'WHERE id = $1'
  await withTransaction(async (tx) => {
    for (const p of players) {
      const answered: AnsweredQuestion[] = p.answered_questions ?? []
      await tx.query(sql, [
        p.id, p.player_score, p.correct_answers_count, p.streak,
        p.lives, p.current_question_index, p.status, JSON.stringify(answered)
      ])
    }
  })
}
