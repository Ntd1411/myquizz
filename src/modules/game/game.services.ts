import { type Question } from '../quiz/quiz.type.js'
import type { Pool } from 'pg'
import { GameRepository } from './game.repository.js'
import { QuizRepository } from '../quiz/quiz.repository.js'
import type {
  GameResponse,
  JoinGameResponse,
  LeaderboardEntry,
  QuestionData,
  GameResult
} from './game.type.js'
import { generateSessionCode, sanitizePlayerName, calculateRank } from './game.ultils.js'
import { AppError } from '../../shared/errors/AppError.js'
import type { CreateGameRequest, JoinGameRequest } from './game.schemas.js'
import type { User } from '../../shared/types/shared.types.js'

export class GameService {
  private gameRepository: GameRepository
  private quizRepository: QuizRepository

  constructor(pool: Pool) {
    this.gameRepository = new GameRepository(pool)
    this.quizRepository = new QuizRepository()
  }

  async createGame(user: User, data: CreateGameRequest): Promise<GameResponse> {
    // Get quiz by ID
    const quiz = await this.quizRepository.getQuizById(data.quiz_id)

    // Check quiz exist
    if (!quiz) {
      throw new AppError(404, 'Quiz not found')
    }

    // Check owner permission
    if (quiz.quiz_owner !== user.id && !quiz.is_public) {
      throw new AppError(403, 'You do not have permission to create a game with this quiz')
    }

    // Insert a quiz snapshot
    const snapshotResult = await this.gameRepository.createQuizSnapshot(data.quiz_id, quiz)

    const snapshotId = snapshotResult.id

    // Generate session code
    let sessionCode: string
    let codeExists: boolean

    do {
      sessionCode = generateSessionCode()
      codeExists = await this.gameRepository.checkSessionCodeExists(sessionCode)
    } while (codeExists)

    // Create game session
    const sessionId = await this.gameRepository.createGameSession(
      snapshotId,
      data.session_name,
      sessionCode,
      user.id,
      quiz.questions?.length || 0
    )

    // Create host player session
    await this.gameRepository.createPlayerSession(
      sessionId,
      user.fullname,
      user.id,
      true
    )

    // Increase host player count
    await this.gameRepository.incrementPlayerCount(sessionId)

    return {
      session_id: sessionId,
      session_code: sessionCode,
      session_name: data.session_name,
      quiz_title: quiz.quiz_name,
      total_questions: quiz.questions.length,
      status: 'waiting'
    }
  }

  async joinGame(sessionCode: string, data: JoinGameRequest): Promise<JoinGameResponse> {
    // Get game session by code
    const gameSession = await this.gameRepository.getGameSessionByCode(sessionCode.toUpperCase())

    if (!gameSession) {
      throw new AppError(404, 'Invalid session code')
    }

    if (gameSession.session_status !== 'waiting') {
      throw new AppError(400, 'Cannot join a game that has already started or ended')
    }

    // Create player session
    const playerName = sanitizePlayerName(data.player_name)

    if (!playerName) {
      throw new AppError(400, 'Invalid player name')
    }

    const playerSessionId = await this.gameRepository.createPlayerSession(
      gameSession.id,
      playerName,
      data.player_id || null,
      false
    )
    // Increase player count
    await this.gameRepository.incrementPlayerCount(gameSession.id)

    return {
      player_session_id: playerSessionId,
      player_name: playerName,
      is_host: false,
      game_info: {
        session_id: gameSession.id,
        session_name: gameSession.session_name,
        total_questions: gameSession.total_questions,
        total_players: gameSession.total_players + 1,
        status: gameSession.session_status
      }
    }
  }

  async startGame(sessionId: number, userId: number): Promise<void> {
    const gameSession = await this.gameRepository.getGameSessionById(sessionId)

    if (!gameSession) {
      throw new AppError(404, 'Game session not found')
    }

    if (gameSession.session_host !== userId) {
      throw new AppError(403, 'Only the host can start the game')
    }

    if (gameSession.session_status !== 'waiting') {
      throw new AppError(400, 'Game has already started or ended')
    }

    await this.gameRepository.updateGameStatus(sessionId, 'active')
  }

  async getQuestionForGame(sessionId: number, questionIndex: number): Promise<QuestionData> {
    const gameSession = await this.gameRepository.getGameSessionById(sessionId)

    if (!gameSession) {
      throw new AppError(404, 'Game session not found')
    }

    const snapshotData = await this.gameRepository.getQuizSnapshotById(gameSession.quiz_snapshot_id)

    if (!snapshotData || !snapshotData.questions) {
      throw new AppError(500, 'Question data not found')
    }

    const questions = snapshotData.questions

    if (questionIndex >= questions.length) {
      throw new AppError(400, 'Invalid question index')
    }

    const question = questions[questionIndex] as Question

    return {
      question_id: question.id,
      question_text: question.question_text,
      question_type: question.question_type,
      time_limit: 30,
      answers: question.answer_options?.map((ans: { option_text: string }) => ({
        answer_text: ans.option_text
      })) || [],
      current_question: questionIndex + 1,
      total_questions: questions.length
    }
  }

  async getLeaderboard(sessionId: number): Promise<LeaderboardEntry[]> {
    const players = await this.gameRepository.getPlayersByGameSession(sessionId)

    const leaderboard = players.map(player => ({
      player_id: player.id,
      player_name: player.player_name,
      player_score: player.player_score,
      correct_answers_count: player.correct_answers_count,
      is_host: player.is_host,
      rank: 0
    }))

    return calculateRank(leaderboard) as LeaderboardEntry[]
  }

  async finishGame(sessionId: number, userId: number): Promise<GameResult> {
    const gameSession = await this.gameRepository.getGameSessionById(sessionId)

    if (!gameSession) {
      throw new AppError(404, 'Game session not found')
    }

    if (gameSession.session_host !== userId) {
      throw new AppError(403, 'Only the host can finish the game')
    }

    if (gameSession.session_status === 'finished') {
      throw new AppError(400, 'Game has already finished')
    }

    await this.gameRepository.updateGameStatus(sessionId, 'finished')

    const leaderboard = await this.getLeaderboard(sessionId)

    return {
      session_id: sessionId,
      session_name: gameSession.session_name,
      total_players: gameSession.total_players,
      leaderboard,
      finished_at: new Date()
    }
  }

  async leaveGame(playerSessionId: number): Promise<void> {
    const playerSession = await this.gameRepository.getPlayerSession(playerSessionId)

    if (!playerSession) {
      throw new AppError(404, 'Player not found')
    }

    await this.gameRepository.deletePlayerSession(playerSessionId)
    await this.gameRepository.decrementPlayerCount(playerSession.game_session_id)
  }

  async getGameSession(sessionId: number) {
    return await this.gameRepository.getGameSessionWithQuizInfo(sessionId)
  }

  async reconnect(playerSessionId: number) {
    const playerSession = await this.gameRepository.getPlayerSession(playerSessionId)

    if (!playerSession) {
      return null
    }

    const gameSession = await this.gameRepository.getGameSessionById(playerSession.game_session_id)

    if (!gameSession || gameSession.session_status === 'finished') {
      return null
    }

    const players = await this.gameRepository.getPlayersByGameSession(gameSession.id)
    const leaderboard = await this.getLeaderboard(gameSession.id)

    let currentQuestion = null
    if (gameSession.session_status === 'active') {
      const answeredCount = playerSession.answered_questions.length
      currentQuestion = await this.getQuestionForGame(gameSession.id, answeredCount)
    }

    return {
      player_session_id: playerSession.id,
      player_name: playerSession.player_name,
      player_score: playerSession.player_score,
      is_host: playerSession.is_host,
      answered_count: playerSession.answered_questions.length,
      correct_count: playerSession.correct_answers_count,
      game_info: {
        session_id: gameSession.id,
        session_name: gameSession.session_name,
        session_status: gameSession.session_status,
        total_questions: gameSession.total_questions,
        total_players: players.length,
        current_question: currentQuestion
      },
      leaderboard
    }
  }
}
