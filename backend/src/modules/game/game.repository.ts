import type { Pool } from 'pg'
import type { GameSession, PlayerSession, AnsweredQuestion, GameSessionWithQuizInfo } from './game.type.js'
import type { Quiz } from '../quiz/quiz.type.js'

export class GameRepository {
  private pool: Pool

  constructor(pool: Pool) {
    this.pool = pool
  }

  async createQuizSnapshot(quizId: number, snapshotData: Quiz): Promise<{ id: number }> {
    const query = `
      INSERT INTO quiz_snapshots (quiz_id, snapshot_data) 
      VALUES ($1, $2) 
      RETURNING id
    `

    const result = await this.pool.query<{ id: number }>(query, [quizId, JSON.stringify(snapshotData)])
    return { id: result.rows[0]?.id ? result.rows[0]?.id : 0 }
  }

  async createGameSession(
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

    const result = await this.pool.query<GameSession>(query, [
      quizSnapshotId,
      sessionName,
      sessionCode,
      sessionHost,
      totalQuestions
    ])

    return result.rows[0]?.id ? result.rows[0]?.id : 0
  }

  async getGameSessionByCode(sessionCode: string): Promise<GameSession | null> {
    const query = `
      SELECT * FROM game_sessions 
      WHERE session_code = $1 AND deleted_at IS NULL
    `

    const result = await this.pool.query<GameSession>(query, [sessionCode])
    return result.rows[0] || null
  }

  async getGameSessionById(sessionId: number): Promise<GameSession | null> {
    const query = `
      SELECT * FROM game_sessions 
      WHERE id = $1 AND deleted_at IS NULL
    `

    const result = await this.pool.query<GameSession>(query, [sessionId])
    return result.rows[0] || null
  }

  async updateGameStatus(sessionId: number, status: string): Promise<void> {
    const query = `
      UPDATE game_sessions 
      SET session_status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `

    await this.pool.query(query, [status, sessionId])
  }

  async createPlayerSession(
    gameSessionId: number,
    playerName: string,
    playerId: number | null,
    isHost: boolean
  ): Promise<number> {
    const query = `
      INSERT INTO player_sessions (
        game_session_id, player_name, player_id, is_host
      )
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `

    const result = await this.pool.query<PlayerSession>(query, [
      gameSessionId,
      playerName,
      playerId,
      isHost
    ])

    return result.rows[0]?.id ? result.rows[0]?.id : 0
  }

  async getPlayerSession(playerSessionId: number): Promise<PlayerSession | null> {
    const query = `
      SELECT * FROM player_sessions 
      WHERE id = $1 AND deleted_at IS NULL
    `

    const result = await this.pool.query<PlayerSession>(query, [playerSessionId])
    return result.rows[0] || null
  }

  async getPlayersByGameSession(gameSessionId: number): Promise<PlayerSession[]> {
    const query = `
      SELECT * FROM player_sessions 
      WHERE game_session_id = $1 AND deleted_at IS NULL
      ORDER BY player_score DESC, created_at ASC
    `

    const result = await this.pool.query<PlayerSession>(query, [gameSessionId])
    return result.rows
  }

  async updatePlayerAnswer(
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

    await this.pool.query(query, [
      JSON.stringify(answeredQuestion),
      answeredQuestion.score_earned,
      answeredQuestion.is_correct ? 1 : 0,
      playerSessionId
    ])
  }

  async getPlayerAnsweredQuestions(playerSessionId: number): Promise<AnsweredQuestion[]> {
    const query = `
      SELECT answered_questions FROM player_sessions 
      WHERE id = $1
    `

    const result = await this.pool.query<{ answered_questions: AnsweredQuestion[] }>(query, [playerSessionId])
    return result.rows[0]?.answered_questions || []
  }

  async checkSessionCodeExists(sessionCode: string): Promise<boolean> {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM game_sessions 
        WHERE session_code = $1 AND deleted_at IS NULL AND session_status IN ('waiting', 'active')
      ) AS exists
    `

    const result = await this.pool.query<{ exists: boolean }>(query, [sessionCode])
    return result.rows[0]?.exists ? result.rows[0].exists : false
  }

  async getHostPlayerSession(gameSessionId: number): Promise<PlayerSession | null> {
    const query = `
      SELECT * FROM player_sessions 
      WHERE game_session_id = $1 AND is_host = true AND deleted_at IS NULL
      LIMIT 1
    `

    const result = await this.pool.query<PlayerSession>(query, [gameSessionId])
    return result.rows[0] || null
  }

  async deletePlayerSession(playerSessionId: number): Promise<void> {
    const query = `
      UPDATE player_sessions 
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `

    await this.pool.query(query, [playerSessionId])
  }

  async findPlayerSessionByUserAndGame(
    gameSessionId: number,
    playerId: number
  ): Promise<PlayerSession | null> {
    const query = `
      SELECT * FROM player_sessions 
      WHERE game_session_id = $1 AND player_id = $2 AND deleted_at IS NULL
      LIMIT 1
    `
    const result = await this.pool.query<PlayerSession>(query, [gameSessionId, playerId])
    return result.rows[0] || null
  }

  async getGameSessionWithQuizInfo(sessionId: number) {
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

    const result = await this.pool.query<GameSessionWithQuizInfo>(query, [sessionId])
    return result.rows[0] || null
  }

  async getQuizSnapshotById(snapshotId: number): Promise<Quiz | null> {
    const query = `
      SELECT snapshot_data FROM quiz_snapshots
      WHERE id = $1
    `

    const result = await this.pool.query<{ snapshot_data: Quiz }>(query, [snapshotId])
    return result.rows[0]?.snapshot_data || null
  }
}
