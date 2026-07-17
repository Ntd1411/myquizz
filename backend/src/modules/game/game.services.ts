import { type Question } from '../quiz/quiz.type.js'
import type { Pool } from 'pg'
import { GameRepository } from './game.repository.js'
import { quizRepository } from '../quiz/quiz.repository.js'
import type {
  CreateGameResponse,
  JoinGameResponse,
  LeaderboardEntry,
  QuestionData,
  GameResult,
  AnswerResult,
  PlayerSession
} from './game.type.js'
import {
  generateSessionCode,
  sanitizePlayerName,
  calculateRank,
  calculateScore
} from './game.utils.js'
import { AppError } from '../../shared/errors/AppError.js'
import type { CreateGameRequest, JoinGameRequest } from './game.schemas.js'
import type { User } from '../../shared/types/shared.types.js'

export class GameService {
  private gameRepository: GameRepository

  constructor(pool: Pool) {
    this.gameRepository = new GameRepository(pool)
  }

  async createGame(user: User, data: CreateGameRequest): Promise<CreateGameResponse> {
    // Get quiz by ID
    const quiz = await quizRepository.getQuizById(data.quiz_id)

    // Check quiz exist
    if (!quiz) {
      throw new AppError(404, 'Quiz not found')
    }

    // Check owner permission
    if (quiz.quiz_owner !== user.id && !quiz.is_public) {
      throw new AppError(
        403,
        'You do not have permission to create a game with this quiz'
      )
    }

    // Insert a quiz snapshot
    const snapshotResult = await this.gameRepository.createQuizSnapshot(
      data.quiz_id,
      quiz
    )

    const snapshotId = snapshotResult.id

    // Generate session code
    let sessionCode: string
    let codeExists: boolean

    do {
      sessionCode = generateSessionCode()
      codeExists =
        await this.gameRepository.checkSessionCodeExists(sessionCode)
    } while (codeExists)

    // Create game session
    const sessionId = await this.gameRepository.createGameSession(
      snapshotId,
      data.session_name,
      sessionCode,
      user.id,
      quiz.questions?.length || 0
    )

    return {
      session_id: sessionId,
      session_code: sessionCode,
      session_name: data.session_name,
      quiz_title: quiz.quiz_name,
      total_questions: quiz.questions.length,
      status: 'waiting'
    }
  }

  async joinGame(
    sessionCode: string,
    data: JoinGameRequest
  ): Promise<JoinGameResponse> {
    // Get game session by code
    const gameSession = await this.gameRepository.getGameSessionByCode(
      sessionCode.toUpperCase()
    )

    if (!gameSession) {
      throw new AppError(404, 'Invalid session code')
    }

    if (gameSession.session_status !== 'waiting') {
      throw new AppError(
        400,
        'Cannot join a game that has already started or ended'
      )
    }

    // Nếu đã đăng nhập thì dùng fullname, không thì dùng player_name
    let playerName: string
    if (data.player_id) {
      // Authenticated user - lấy fullname từ database hoặc data
      playerName = data.player_name || 'User'
    } else {
      // Guest - phải có player_name
      playerName = sanitizePlayerName(data.player_name)
      if (!playerName) {
        throw new AppError(400, 'Invalid player name')
      }
    }

    // Check if player is the host
    const isHost = data.player_id === gameSession.session_host

    // Tạo player session mới (không check duplicate nữa vì host không gọi join-room)
    const playerSessionId = await this.gameRepository.createPlayerSession(
      gameSession.id,
      playerName,
      data.player_id || null,
      isHost
    )

    return {
      player_session_id: playerSessionId,
      player_name: playerName,
      is_host: isHost,
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

  async getQuestionForGame(
    sessionId: number,
    questionIndex: number
  ): Promise<QuestionData> {
    const gameSession = await this.gameRepository.getGameSessionById(sessionId)

    if (!gameSession) {
      throw new AppError(404, 'Game session not found')
    }

    const snapshotData = await this.gameRepository.getQuizSnapshotById(
      gameSession.quiz_snapshot_id
    )

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
      answers:
        question.answer_options?.map((ans: { option_text: string }) => ({
          answer_text: ans.option_text
        })) || [],
      current_question: questionIndex + 1,
      total_questions: questions.length
    }
  }

  async submitAnswer(
    playerSessionId: number,
    data: {
      question_id: number;
      answer_id: number | undefined;
      answer_text: string | undefined;
      answer_ids: number[] | undefined;
      time_taken: number;
    }
  ): Promise<AnswerResult> {
    const playerSession =
      await this.gameRepository.getPlayerSession(playerSessionId)

    if (!playerSession) {
      throw new AppError(404, 'Player session not found')
    }

    const gameSession = await this.gameRepository.getGameSessionById(
      playerSession.game_session_id
    )

    if (!gameSession) {
      throw new AppError(404, 'Game session not found')
    }

    const snapshotData = await this.gameRepository.getQuizSnapshotById(
      gameSession.quiz_snapshot_id
    )

    if (!snapshotData || !snapshotData.questions) {
      throw new AppError(500, 'Question data not found')
    }

    const question = snapshotData.questions.find(
      (q: Question) => q.id === data.question_id
    )

    if (!question) {
      throw new AppError(404, 'Question not found')
    }

    let isCorrect = false
    let answerId = data.answer_id || -1

    // Handle short_answer and long_answer types
    if (
      question.question_type === 'short_answer' ||
      question.question_type === 'long_answer'
    ) {
      const answerText = data.answer_text?.trim().toLowerCase() || ''
      const correctAnswerText =
        (question.correct_answer as { option_text: string })?.option_text?.trim().toLowerCase() || ''

      if (!answerText) {
        isCorrect = false
      } else {
        isCorrect = answerText === correctAnswerText
      }
      answerId = isCorrect ? 0 : -1
    } else {
      if (!question.answer_options || question.answer_options.length === 0) {
        throw new AppError(500, 'Question has no answer options')
      }

      // If answer_id is -1, player didn't answer (time ran out)
      if (data.answer_id === -1) {
        isCorrect = false
      } else if (Array.isArray(question.correct_answer)) {
        // Handle multiple_choice type
        const correctAnswers = question.correct_answer.map(
          (ans: { option_text: string }) => ans.option_text
        )

        const answerOptions = question.answer_options
        const selectedAnswer = answerOptions[data.answer_id]

        if (selectedAnswer) {
          isCorrect = correctAnswers.includes(selectedAnswer.option_text)
        }
      } else {
        // Handle multiple_choice type
        const correctAnswerText = (question.correct_answer as { option_text: string })?.option_text

        const answerOptions = question.answer_options
        const selectedAnswer = answerOptions[data.answer_id]

        if (selectedAnswer) {
          isCorrect = selectedAnswer.option_text === correctAnswerText
        }
      }
    }

    const timeLimit = question.time_limit || 30
    const timeTaken = Math.min(data.time_taken, timeLimit * 1000)
    const scoreEarned = isCorrect
      ? calculateScore(isCorrect, timeTaken, timeLimit)
      : 0

    const answeredQuestion = {
      question_id: data.question_id,
      answer_id: answerId,
      is_correct: isCorrect,
      time_taken: timeTaken,
      score_earned: scoreEarned,
      answered_at: new Date()
    }

    await this.gameRepository.updatePlayerAnswer(
      playerSessionId,
      answeredQuestion
    )

    const updatedPlayerSession =
      await this.gameRepository.getPlayerSession(playerSessionId)

    return {
      is_correct: isCorrect,
      score_earned: scoreEarned,
      correct_answer_id: answerId,
      time_taken: timeTaken,
      total_score: updatedPlayerSession?.player_score || 0
    }
  }

  async getLeaderboard(sessionId: number): Promise<LeaderboardEntry[]> {
    const players =
      await this.gameRepository.getPlayersByGameSession(sessionId)

    const leaderboard = players.map((player) => ({
      player_id: player.id,
      player_name: player.player_name,
      player_score: player.player_score,
      correct_answers_count: player.correct_answers_count,
      is_host: player.is_host,
      rank: 0
    }))

    return calculateRank(leaderboard)
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

  async kickPlayer(
    userId: number,
    sessionId: number,
    playerSessionId: number
  ): Promise<PlayerSession> {
    const gameSession = await this.gameRepository.getGameSessionById(sessionId)

    if (!gameSession) {
      throw new Error('Game session not found')
    }

    if (gameSession.session_host !== userId) {
      throw new Error('Only the host can kick players')
    }

    const playerSession =
      await this.gameRepository.getPlayerSession(playerSessionId)

    if (!playerSession) {
      throw new Error('Player not found')
    }

    if (playerSession.is_host) {
      throw new Error('You cannot kick the host')
    }

    await this.gameRepository.deletePlayerSession(playerSessionId)
    return playerSession
  }

  async getGameSession(sessionId: number) {
    return await this.gameRepository.getGameSessionWithQuizInfo(sessionId)
  }

  async reconnect(playerSessionId: number) {
    const playerSession =
      await this.gameRepository.getPlayerSession(playerSessionId)

    if (!playerSession) {
      return null
    }

    const gameSession = await this.gameRepository.getGameSessionById(
      playerSession.game_session_id
    )

    if (!gameSession || gameSession.session_status === 'finished') {
      return null
    }

    const players = await this.gameRepository.getPlayersByGameSession(
      gameSession.id
    )
    const leaderboard = await this.getLeaderboard(gameSession.id)

    let currentQuestion = null
    if (gameSession.session_status === 'active') {
      const answeredCount = playerSession.answered_questions?.length || 0
      currentQuestion = await this.getQuestionForGame(
        gameSession.id,
        answeredCount
      )
    }

    return {
      player_session_id: playerSession.id,
      player_name: playerSession.player_name,
      player_score: playerSession.player_score,
      is_host: playerSession.is_host,
      answered_count: playerSession.answered_questions?.length || 0,
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

  async submitAnswerAndGetNext(
    playerSessionId: number,
    userId: number | undefined,
    data: {
      question_id: number;
      answer_id: number | undefined;
      answer_text: string | undefined;
      answer_ids: number[] | undefined;
      time_taken: number;
    },
    sessionId: number
  ) {
    const playerSession =
      await this.gameRepository.getPlayerSession(playerSessionId)

    if (!playerSession) {
      throw new AppError(404, 'Player not found')
    }

    if (userId && playerSession.player_id !== userId) {
      throw new AppError(
        403,
        'You do not have permission to answer for this player'
      )
    }

    const result = await this.submitAnswer(playerSessionId, data)

    const gameSession = await this.gameRepository.getGameSessionById(sessionId)

    if (!gameSession) {
      throw new AppError(404, 'Session not found')
    }

    // Get updated player session after submitting answer
    const updatedPlayerSession =
      await this.gameRepository.getPlayerSession(playerSessionId)

    if (!updatedPlayerSession) {
      throw new AppError(404, 'Player session not found')
    }

    const currentQuestionIndex =
      updatedPlayerSession.answered_questions?.length || 0
    const totalQuestions = gameSession.total_questions

    let nextQuestion = null
    let isCompleted = false

    if (currentQuestionIndex < totalQuestions) {
      nextQuestion = await this.getQuestionForGame(
        sessionId,
        currentQuestionIndex
      )
    } else {
      isCompleted = true
    }

    const allPlayers =
      await this.gameRepository.getPlayersByGameSession(sessionId)
    const completedCount = allPlayers.filter(
      (p) => (p.answered_questions?.length || 0) >= totalQuestions
    ).length

    const allCompleted = completedCount === allPlayers.length
    let leaderboard = null

    if (allCompleted) {
      leaderboard = await this.getLeaderboard(sessionId)
    }

    return {
      result,
      nextQuestion,
      currentQuestionIndex,
      totalQuestions,
      isCompleted,
      progressUpdate: {
        completed: completedCount,
        total: allPlayers.length,
        percentage: Math.round((completedCount / allPlayers.length) * 100)
      },
      allCompleted,
      leaderboard
    }
  }

  async getCurrentQuestionForPlayer(
    playerSessionId: number,
    userId: number | undefined,
    sessionId: number
  ) {
    const playerSession =
      await this.gameRepository.getPlayerSession(playerSessionId)

    if (!playerSession) {
      throw new AppError(404, 'Player not found')
    }

    if (userId && playerSession.player_id !== userId) {
      throw new AppError(
        403,
        'You do not have permission to access this player data'
      )
    }

    const gameSession = await this.gameRepository.getGameSessionById(sessionId)

    if (!gameSession) {
      throw new AppError(404, 'Session not found')
    }

    const currentQuestionIndex = playerSession.answered_questions?.length || 0
    const totalQuestions = gameSession.total_questions

    if (currentQuestionIndex >= totalQuestions) {
      return {
        isCompleted: true,
        currentQuestion: null,
        currentQuestionIndex,
        totalQuestions
      }
    }

    const currentQuestion = await this.getQuestionForGame(
      sessionId,
      currentQuestionIndex
    )

    return {
      isCompleted: false,
      currentQuestion,
      currentQuestionIndex,
      totalQuestions
    }
  }

  async getPlayerSessionById(
    playerSessionId: number
  ): Promise<PlayerSession | null> {
    return await this.gameRepository.getPlayerSession(playerSessionId)
  }

  async getGameSessionById(sessionId: number) {
    return await this.gameRepository.getGameSessionById(sessionId)
  }

  async getPlayersByGameSession(
    gameSessionId: number
  ): Promise<PlayerSession[]> {
    return await this.gameRepository.getPlayersByGameSession(gameSessionId)
  }
}
