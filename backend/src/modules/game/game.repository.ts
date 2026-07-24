import { pool, withTransaction } from '../../infrastructure/database/connection.js'
import { generateSessionCode } from './game.utils.js'
import type { GameConfig } from './game.schemas.js'
import type { GameSessionRow, PlayerSessionRow } from './game.type.js'

const isUniqueViolation = (e: unknown) =>
  typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505'

// ---------- Quiz snapshot: chốt đề tại thời điểm tạo trận ----------
export const createQuizSnapshot = async (quizId: number) => {
  const { rows } = await pool.query(
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
  if (!rows[0]) throw new Error('Quiz không tồn tại khi tạo snapshot')
  return rows[0] as { id: number; total_questions: number }
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
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO game_sessions
           (quiz_snapshot_id, session_name, session_code, session_host,
            game_mode, config, total_questions)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [data.quiz_snapshot_id, data.session_name, generateSessionCode(), data.session_host,
          data.game_mode, JSON.stringify(data.config), data.total_questions]
      )
      return rows[0] as GameSessionRow
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 4) continue // trùng session_code -> thử mã khác
      throw e
    }
  }
  throw new Error('Không sinh được session_code duy nhất')
}

export const getSessionByCode = async (code: string) => {
  const { rows } = await pool.query(
    'SELECT * FROM game_sessions WHERE session_code = $1 AND deleted_at IS NULL',
    [code]
  )
  return (rows[0] as GameSessionRow) ?? null
}

export const getSessionById = async (id: number) => {
  const { rows } = await pool.query(
    'SELECT * FROM game_sessions WHERE id = $1 AND deleted_at IS NULL',
    [id]
  )
  return (rows[0] as GameSessionRow) ?? null
}

export const updateSessionConfig = async (id: number, config: GameConfig) => {
  const { rows } = await pool.query(
    `UPDATE game_sessions SET config = $2, updated_at = now()
      WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(config)]
  )
  return rows[0] as GameSessionRow
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
  const { rows } = await pool.query(
    'SELECT * FROM player_sessions WHERE id = $1 AND deleted_at IS NULL',
    [id]
  )
  return (rows[0] as PlayerSessionRow) ?? null
}

export const listPlayers = async (gameSessionId: number) => {
  const { rows } = await pool.query(
    `SELECT id, player_name, player_score, status
       FROM player_sessions
      WHERE game_session_id = $1 AND deleted_at IS NULL
      ORDER BY created_at ASC`,
    [gameSessionId]
  )
  return rows as Array<Pick<PlayerSessionRow, 'id' | 'player_name' | 'player_score' | 'status'>>
}

export const createPlayerSession = async (data: {
  game_session_id: number
  player_id: number | null
  player_guest_id: string | null
  player_name: string
  lives: number | null
}): Promise<PlayerSessionRow> =>
  withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `INSERT INTO player_sessions
         (game_session_id, player_id, player_guest_id, player_name, lives)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.game_session_id, data.player_id, data.player_guest_id, data.player_name, data.lives]
    )
    await tx.query(
      'UPDATE game_sessions SET total_players = total_players + 1 WHERE id = $1',
      [data.game_session_id]
    )
    return rows[0] as PlayerSessionRow
  })

// ---------- Leaderboard / results ----------
export const getLeaderboard = async (gameSessionId: number) => {
  const { rows } = await pool.query(
    `SELECT id, player_name, player_score, correct_answers_count, streak, status
       FROM player_sessions
      WHERE game_session_id = $1 AND deleted_at IS NULL
      ORDER BY player_score DESC, correct_answers_count DESC`,
    [gameSessionId]
  )
  return rows.map((r, i) => ({ rank: i + 1, ...r }))
}

// phân tích từng câu: bủng answered_questions của mọi player
export const getQuestionStats = async (gameSessionId: number) => {
  const { rows } = await pool.query(
    `SELECT
        (ans->>'question_id')::int              AS question_id,
        count(*)                                AS answer_count,
        count(*) FILTER (WHERE (ans->>'is_correct')::boolean) AS correct_count
     FROM player_sessions ps,
          jsonb_array_elements(ps.answered_questions) AS ans
     WHERE ps.game_session_id = $1 AND ps.deleted_at IS NULL
     GROUP BY (ans->>'question_id')::int
     ORDER BY question_id`,
    [gameSessionId]
  )
  return rows
}
