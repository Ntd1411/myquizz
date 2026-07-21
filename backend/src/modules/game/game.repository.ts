import { pool } from '../../infrastructure/database/connection.js'
import type {
  GameSession,
  PlayerSession,
  AnsweredQuestion,
  GameSessionWithQuizInfo
} from './game.type.js'
import type { Quiz } from '../quiz/quiz.type.js'

export async function createQuizSnapshot(
  quizId: number,
  snapshotData: Quiz
): Promise<{ id: number }> {
  const query = `
      INSERT INTO quiz_snapshots (quiz_id, snapshot_data) 
      VALUES ($1, $2) 
      RETURNING id
    `

  const result = await pool.query<{ id: number }>(query, [
    quizId,
    JSON.stringify(snapshotData)
  ])
  return { id: result.rows[0]?.id ? result.rows[0]?.id : 0 }
}

export async function createGameSession(
  quizSnapshotId: number,
  sessionName: string,
  sessionCode: string,
  sessionHost: number,
  totalQuestions: number
): Promise<number> {
  const query = `
      INSERT INTO game_sessions (
        quiz_snapshot_id, session_name, session_code, 
        session_host, total_questions, session_status
      )
      VALUES ($1, $2, $3, $4, $5, 'waiting')
      RETURNING id
    `

  const result = await pool.query<GameSession>(query, [
    quizSnapshotId,
    sessionName,
    sessionCode,
    sessionHost,
    totalQuestions
  ])

  return result.rows[0]?.id ? result.rows[0]?.id : 0
}

export async function getGameSessionByCode(
  sessionCode: string
): Promise<GameSession | null> {
  const query = `
      SELECT * FROM game_sessions 
      WHERE session_code = $1 AND deleted_at IS NULL
    `

  const result = await pool.query<GameSession>(query, [sessionCode])
  return result.rows[0] || null
}

export async function getGameSessionById(
  sessionId: number
): Promise<GameSession | null> {
  const query = `
      SELECT * FROM game_sessions 
      WHERE id = $1 AND deleted_at IS NULL
    `

  const result = await pool.query<GameSession>(query, [sessionId])
  return result.rows[0] || null
}

export async function updateGameStatus(
  sessionId: number,
  status: string
): Promise<void> {
  const query = `
      UPDATE game_sessions 
      SET session_status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `

  await pool.query(query, [status, sessionId])
}

export async function createPlayerSession(
  gameSessionId: number,
  playerName: string,
  playerId: number | null
): Promise<number> {
  const query = `
      INSERT INTO player_sessions (
        game_session_id, player_name, player_id
      )
      VALUES ($1, $2, $3)
      RETURNING id
    `

  const result = await pool.query<PlayerSession>(query, [
    gameSessionId,
    playerName,
    playerId
  ])

  return result.rows[0]?.id ? result.rows[0]?.id : 0
}

export async function getPlayerSession(
  playerSessionId: number
): Promise<PlayerSession | null> {
  const query = `
      SELECT * FROM player_sessions 
      WHERE id = $1 AND deleted_at IS NULL
    `

  const result = await pool.query<PlayerSession>(query, [playerSessionId])
  return result.rows[0] || null
}

export async function getPlayersByGameSession(
  gameSessionId: number
): Promise<PlayerSession[]> {
  const query = `
      SELECT * FROM player_sessions 
      WHERE game_session_id = $1 AND deleted_at IS NULL
      ORDER BY player_score DESC, created_at ASC
    `

  const result = await pool.query<PlayerSession>(query, [gameSessionId])
  return result.rows
}

export async function updatePlayerAnswer(
  playerSessionId: number,
  answeredQuestion: AnsweredQuestion
): Promise<void> {
  const query = `
      UPDATE player_sessions 
      SET 
        answered_questions = COALESCE(answered_questions, '[]'::jsonb) || $1::jsonb,
        player_score = player_score + $2,
        correct_answers_count = correct_answers_count + $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `

  await pool.query(query, [
    JSON.stringify(answeredQuestion),
    answeredQuestion.score_earned,
    answeredQuestion.is_correct ? 1 : 0,
    playerSessionId
  ])
}

export async function getPlayerAnsweredQuestions(
  playerSessionId: number
): Promise<AnsweredQuestion[]> {
  const query = `
      SELECT answered_questions FROM player_sessions 
      WHERE id = $1
    `

  const result = await pool.query<{ answered_questions: AnsweredQuestion[] }>(
    query,
    [playerSessionId]
  )
  return result.rows[0]?.answered_questions || []
}

export async function checkSessionCodeExists(
  sessionCode: string
): Promise<boolean> {
  const query = `
      SELECT EXISTS(
        SELECT 1 FROM game_sessions 
        WHERE session_code = $1 AND deleted_at IS NULL AND session_status IN ('waiting', 'active')
      ) AS exists
    `

  const result = await pool.query<{ exists: boolean }>(query, [sessionCode])
  return result.rows[0]?.exists ? result.rows[0].exists : false
}

export async function getHostPlayerSession(
  gameSessionId: number
): Promise<PlayerSession | null> {
  const query = `
      SELECT * FROM player_sessions 
      WHERE game_session_id = $1 AND is_host = true AND deleted_at IS NULL
      LIMIT 1
    `

  const result = await pool.query<PlayerSession>(query, [gameSessionId])
  return result.rows[0] || null
}

export async function deletePlayerSession(
  playerSessionId: number
): Promise<void> {
  const query = `
      UPDATE player_sessions 
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `

  await pool.query(query, [playerSessionId])
}

export async function findPlayerSessionByUserAndGame(
  gameSessionId: number,
  playerId: number
): Promise<PlayerSession | null> {
  const query = `
      SELECT * FROM player_sessions 
      WHERE game_session_id = $1 AND player_id = $2 AND deleted_at IS NULL
      LIMIT 1
    `
  const result = await pool.query<PlayerSession>(query, [
    gameSessionId,
    playerId
  ])
  return result.rows[0] || null
}

export async function getGameSessionWithQuizInfo(sessionId: number) {
  const query = `
      SELECT 
        gs.*,
        qs.quiz_id,
        q.quiz_name,
        q.quiz_description
      FROM game_sessions gs
      JOIN quiz_snapshots qs ON gs.quiz_snapshot_id = qs.id
      JOIN quizzes q ON qs.quiz_id = q.id
      WHERE gs.id = $1 AND gs.deleted_at IS NULL
    `

  const result = await pool.query<GameSessionWithQuizInfo>(query, [sessionId])
  return result.rows[0] || null
}

export async function getQuizSnapshotById(
  snapshotId: number
): Promise<Quiz | null> {
  const query = `
      SELECT snapshot_data FROM quiz_snapshots
      WHERE id = $1
    `

  const result = await pool.query<{ snapshot_data: Quiz }>(query, [snapshotId])
  return result.rows[0]?.snapshot_data || null
}
