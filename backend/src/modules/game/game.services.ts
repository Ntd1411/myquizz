import { type Question } from '../quiz/quiz.type.js'
import * as gameRepository from './game.repository.js'
import { quizRepository } from '../quiz/quiz.repository.js'
import type {
  JoinGameResponse,
  LeaderboardEntry,
  QuestionData,
  GameResult,
  AnswerResult,
  PlayerSession,
  GameSession
} from './game.type.js'
import {
  generateSessionCode,
  calculateRank,
  calculateScore,
  toStringRecord,
  convertToGameSessionFromHash
} from './game.utils.js'
import { AppError } from '../../shared/errors/AppError.js'
import type { CreateGameRequest, JoinGameRequest } from './game.schemas.js'
import type { User } from '../../shared/types/shared.types.js'
import CacheService from '../../infrastructure/cache/cache.service.js'
import { PlayerCacheService } from './player-cache.service.js'

export async function createGame(user: User, data: CreateGameRequest): Promise<GameSession> {
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
  const snapshotResult = await gameRepository.createQuizSnapshot(
    data.quiz_id,
    quiz
  )

  // Cache snapshot quiz
  await CacheService.set(`quiz_snapshot:${snapshotResult.id}`, quiz, 7200)

  const snapshotId = snapshotResult.id

  // Generate session code
  let sessionCode: string
  let codeExists: boolean

  do {
    sessionCode = generateSessionCode()
    codeExists = await gameRepository.checkSessionCodeExists(sessionCode)
  } while (codeExists)

  // Create game session
  const session = await gameRepository.createGameSession(
    snapshotId,
    data.session_name,
    sessionCode,
    user.id,
    quiz.questions.length
  )

  if (!session) {
    throw new AppError(500, 'Fail to create game session')
  }

  // Cache game session dưới dạng hash
  await CacheService.setHashMultiple(
    `game:${sessionCode}`,
    toStringRecord(session),
    7200
  )

  return session
}

export async function joinGame(
  sessionCode: string,
  data: JoinGameRequest
): Promise<JoinGameResponse> {
  // Get game session by code từ hash cache
  let gameSession: GameSession | null
  const cachedHash = await CacheService.getAllHash<string>(`game:${sessionCode}`)

  if (Object.keys(cachedHash).length > 0) {
    // Parse hash thành GameSession object
    gameSession = convertToGameSessionFromHash(cachedHash)
  } else {
    // Nếu không có cache, query từ database
    gameSession = await gameRepository.getGameSessionByCode(sessionCode)

    if (gameSession) {
      // Cache lại dưới dạng hash
      await CacheService.setHashMultiple(
        `game:${sessionCode}`,
        toStringRecord(gameSession),
        7200
      )
    }
  }

  if (!gameSession) {
    throw new AppError(404, 'Invalid session code')
  }

  if (gameSession.session_status !== 'waiting') {
    throw new AppError(
      400,
      'Cannot join a game that has already started or ended'
    )
  }

  // Tạo player session mới
  const playerSession = await gameRepository.createPlayerSession(
    gameSession.id,
    data.player_name,
    data.player_id || null
  )

  if (!playerSession) {
    throw new AppError(500, 'Failed to create player session')
  }

  await PlayerCacheService.savePlayerSession(playerSession)

  return {
    player_session_id: playerSession.id,
    player_name: data.player_name,
    game_info: gameSession
  }
}

export async function startGame(sessionId: number, userId: number): Promise<void> {
  const gameSession = await gameRepository.getGameSessionById(sessionId)

  if (!gameSession) {
    throw new AppError(404, 'Game session not found')
  }

  if (gameSession.session_host !== userId) {
    throw new AppError(403, 'Only the host can start the game')
  }

  if (gameSession.session_status !== 'waiting') {
    throw new AppError(400, 'Game has already started or ended')
  }

  await gameRepository.updateGameStatus(sessionId, 'active')
}

export async function getQuestionForGame(
  sessionId: number,
  questionIndex: number
): Promise<QuestionData> {
  const gameSession = await gameRepository.getGameSessionById(sessionId)

  if (!gameSession) {
    throw new AppError(404, 'Game session not found')
  }

  const snapshotData = await gameRepository.getQuizSnapshotById(
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

// export async function submitAnswer(
//   playerSessionId: number,
//   gameSessionId: number,
//   data: {
//       question_id: number;
//       answer_id: number | undefined;
//       answer_text: string | undefined;
//       answer_ids: number[] | undefined;
//       time_taken: number;
//     }
// ): Promise<AnswerResult> {
//   // Thử lấy từ cache trước
//   let playerSession = await PlayerCacheService.getPlayerSession(gameSessionId, playerSessionId)

//   if (!playerSession) {
//     playerSession = await gameRepository.getPlayerSession(playerSessionId)
//     if (playerSession) {
//       await PlayerCacheService.savePlayerSession(playerSession)
//     }
//   }

//   if (!playerSession) {
//     throw new AppError(404, 'Player session not found')
//   }

//   const gameSession = await gameRepository.getGameSessionById(
//     playerSession.game_session_id
//   )

//   if (!gameSession) {
//     throw new AppError(404, 'Game session not found')
//   }

//   const snapshotData = await gameRepository.getQuizSnapshotById(
//     gameSession.quiz_snapshot_id
//   )

//   if (!snapshotData || !snapshotData.questions) {
//     throw new AppError(500, 'Question data not found')
//   }

//   const question = snapshotData.questions.find(
//     (q: Question) => q.id === data.question_id
//   )

//   if (!question) {
//     throw new AppError(404, 'Question not found')
//   }

//   let isCorrect = false
//   let answerId = data.answer_id || -1

//   // Handle short_answer and long_answer types
//   if (
//     question.question_type === 'short_answer' ||
//       question.question_type === 'long_answer'
//   ) {
//     const answerText = data.answer_text?.trim().toLowerCase() || ''
//     const correctAnswerText =
//         (question.correct_answer as { option_text: string })?.option_text?.trim().toLowerCase() || ''

//     if (!answerText) {
//       isCorrect = false
//     } else {
//       isCorrect = answerText === correctAnswerText
//     }
//     answerId = isCorrect ? 0 : -1
//   } else {
//     if (!question.answer_options || question.answer_options.length === 0) {
//       throw new AppError(500, 'Question has no answer options')
//     }

//     // If answer_id is -1, player didn't answer (time ran out)
//     if (data.answer_id === -1) {
//       isCorrect = false
//     } else if (Array.isArray(question.correct_answer)) {
//       // Handle multiple_choice type
//       const correctAnswers = question.correct_answer.map(
//         (ans: { option_text: string }) => ans.option_text
//       )

//       const answerOptions = question.answer_options
//       const selectedAnswer = answerOptions[data.answer_id]

//       if (selectedAnswer) {
//         isCorrect = correctAnswers.includes(selectedAnswer.option_text)
//       }
//     } else {
//       // Handle multiple_choice type
//       const correctAnswerText = (question.correct_answer as { option_text: string })?.option_text

//       const answerOptions = question.answer_options
//       const selectedAnswer = answerOptions[data.answer_id]

//       if (selectedAnswer) {
//         isCorrect = selectedAnswer.option_text === correctAnswerText
//       }
//     }
//   }

//   const timeLimit = question.time_limit || 30
//   const timeTaken = Math.min(data.time_taken, timeLimit * 1000)
//   const scoreEarned = isCorrect
//     ? calculateScore(isCorrect, timeTaken, timeLimit)
//     : 0

//   const answeredQuestion = {
//     question_id: data.question_id,
//     answer_id: answerId,
//     is_correct: isCorrect,
//     time_taken: timeTaken,
//     score_earned: scoreEarned,
//     answered_at: new Date()
//   }

//   // Cập nhật database
//   await gameRepository.updatePlayerAnswer(
//     playerSessionId,
//     answeredQuestion
//   )

//   // Cập nhật cache
//   await PlayerCacheService.addAnswer(
//     playerSessionId,
//     playerSession.game_session_id,
//     answeredQuestion
//   )

//   // Lấy điểm mới từ cache
//   const updatedPlayerSession = await PlayerCacheService.getPlayerSession(gameSessionId, playerSessionId)

//   return {
//     is_correct: isCorrect,
//     score_earned: scoreEarned,
//     correct_answer_id: answerId,
//     time_taken: timeTaken,
//     total_score: updatedPlayerSession?.player_score || 0
//   }
// }

// export async function getLeaderboard(sessionId: number): Promise<LeaderboardEntry[]> {
//   // Thử lấy từ cache trước
//   const cachedLeaderboard = await PlayerCacheService.getLeaderboard(sessionId)

//   if (cachedLeaderboard && cachedLeaderboard.length > 0) {
//     return cachedLeaderboard
//   }

//   // Nếu không có cache, query từ database
//   const players = await gameRepository.getPlayersByGameSession(sessionId)

//   const leaderboard = players.map((player) => ({
//     player_id: player.id,
//     player_name: player.player_name,
//     player_score: player.player_score,
//     correct_answers_count: player.correct_answers_count,
//     is_host: player.is_host,
//     rank: 0
//   }))

//   const rankedLeaderboard = calculateRank(leaderboard)

//   // Cache lại players để lần sau dùng
//   const savePromises = players.map(player =>
//     PlayerCacheService.savePlayerSession(player)
//   )
//   await Promise.all(savePromises)

//   return rankedLeaderboard
// }

// export async function finishGame(sessionId: number, userId: number): Promise<GameResult> {
//   const gameSession = await gameRepository.getGameSessionById(sessionId)

//   if (!gameSession) {
//     throw new AppError(404, 'Game session not found')
//   }

//   if (gameSession.session_host !== userId) {
//     throw new AppError(403, 'Only the host can finish the game')
//   }

//   if (gameSession.session_status === 'finished') {
//     throw new AppError(400, 'Game has already finished')
//   }

//   await gameRepository.updateGameStatus(sessionId, 'finished')

//   const leaderboard = await getLeaderboard(sessionId)

//   // Xóa cache của game sau khi kết thúc (tùy chọn, có thể giữ lại để xem kết quả)
//   // await PlayerCacheService.clearGameCache(sessionId)

//   return {
//     session_id: sessionId,
//     session_name: gameSession.session_name,
//     total_players: gameSession.total_players,
//     leaderboard,
//     finished_at: new Date()
//   }
// }

// export async function kickPlayer(
//   userId: number,
//   sessionId: number,
//   playerSessionId: number
// ): Promise<PlayerSession> {
//   const gameSession = await gameRepository.getGameSessionById(sessionId)

//   if (!gameSession) {
//     throw new Error('Game session not found')
//   }

//   if (gameSession.session_host !== userId) {
//     throw new Error('Only the host can kick players')
//   }

//   const playerSession =
//       await gameRepository.getPlayerSession(playerSessionId)

//   if (!playerSession) {
//     throw new Error('Player not found')
//   }

//   if (playerSession.is_host) {
//     throw new Error('You cannot kick the host')
//   }

//   // Xóa khỏi database
//   await gameRepository.deletePlayerSession(playerSessionId)

//   // Xóa khỏi cache
//   await PlayerCacheService.removePlayer(playerSessionId, sessionId)

//   return playerSession
// }

// export async function getGameSession(sessionId: number) {
//   return await gameRepository.getGameSessionWithQuizInfo(sessionId)
// }

// export async function reconnect(playerSessionId: number) {
//   // Thử lấy từ cache trước
//   let playerSession = await PlayerCacheService.getPlayerSession(playerSessionId)

//   if (!playerSession) {
//     playerSession = await gameRepository.getPlayerSession(playerSessionId)
//     if (playerSession) {
//       await PlayerCacheService.savePlayerSession(playerSession)
//     }
//   }

//   if (!playerSession) {
//     return null
//   }

//   const gameSession = await gameRepository.getGameSessionById(
//     playerSession.game_session_id
//   )

//   if (!gameSession || gameSession.session_status === 'finished') {
//     return null
//   }

//   const players = await gameRepository.getPlayersByGameSession(
//     gameSession.id
//   )
//   const leaderboard = await getLeaderboard(gameSession.id)

//   let currentQuestion = null
//   if (gameSession.session_status === 'active') {
//     const answeredCount = playerSession.answered_questions?.length || 0
//     currentQuestion = await getQuestionForGame(
//       gameSession.id,
//       answeredCount
//     )
//   }

//   return {
//     player_session_id: playerSession.id,
//     player_name: playerSession.player_name,
//     player_score: playerSession.player_score,
//     is_host: playerSession.is_host,
//     answered_count: playerSession.answered_questions?.length || 0,
//     correct_count: playerSession.correct_answers_count,
//     game_info: {
//       session_id: gameSession.id,
//       session_name: gameSession.session_name,
//       session_status: gameSession.session_status,
//       total_questions: gameSession.total_questions,
//       total_players: players.length,
//       current_question: currentQuestion
//     },
//     leaderboard
//   }
// }

// export async function submitAnswerAndGetNext(
//   playerSessionId: number,
//   userId: number | undefined,
//   data: {
//       question_id: number;
//       answer_id: number | undefined;
//       answer_text: string | undefined;
//       answer_ids: number[] | undefined;
//       time_taken: number;
//     },
//   sessionId: number
// ) {
//   // Thử lấy từ cache trước
//   let playerSession = await PlayerCacheService.getPlayerSession(playerSessionId)

//   if (!playerSession) {
//     playerSession = await gameRepository.getPlayerSession(playerSessionId)
//     if (playerSession) {
//       await PlayerCacheService.savePlayerSession(playerSession)
//     }
//   }

//   if (!playerSession) {
//     throw new AppError(404, 'Player not found')
//   }

//   if (userId && playerSession.player_id !== userId) {
//     throw new AppError(
//       403,
//       'You do not have permission to answer for this player'
//     )
//   }

//   const result = await submitAnswer(playerSessionId, data)

//   const gameSession = await gameRepository.getGameSessionById(sessionId)

//   if (!gameSession) {
//     throw new AppError(404, 'Session not found')
//   }

//   // Lấy updated player session từ cache
//   const updatedPlayerSession = await PlayerCacheService.getPlayerSession(playerSessionId)

//   if (!updatedPlayerSession) {
//     throw new AppError(404, 'Player session not found')
//   }

//   const currentQuestionIndex =
//       updatedPlayerSession.answered_questions?.length || 0
//   const totalQuestions = gameSession.total_questions

//   let nextQuestion = null
//   let isCompleted = false

//   if (currentQuestionIndex < totalQuestions) {
//     nextQuestion = await getQuestionForGame(
//       sessionId,
//       currentQuestionIndex
//     )
//   } else {
//     isCompleted = true
//   }

//   // Đếm số players đã hoàn thành từ cache
//   const completedCount = await PlayerCacheService.countCompletedPlayers(
//     sessionId,
//     totalQuestions
//   )

//   // Lấy tổng số players
//   const playerIds = await PlayerCacheService.getPlayerIds(sessionId)
//   const totalPlayers = playerIds.length

//   const allCompleted = completedCount === totalPlayers
//   let leaderboard = null

//   if (allCompleted) {
//     leaderboard = await getLeaderboard(sessionId)
//   }

//   return {
//     result,
//     nextQuestion,
//     currentQuestionIndex,
//     totalQuestions,
//     isCompleted,
//     progressUpdate: {
//       completed: completedCount,
//       total: totalPlayers,
//       percentage: Math.round((completedCount / totalPlayers) * 100)
//     },
//     allCompleted,
//     leaderboard
//   }
// }
// export async function getCurrentQuestionForPlayer(
//   playerSessionId: number,
//   userId: number | undefined,
//   sessionId: number
// ) {
//   // Thử lấy từ cache trước
//   let playerSession = await PlayerCacheService.getPlayerSession(playerSessionId)

//   if (!playerSession) {
//     playerSession = await gameRepository.getPlayerSession(playerSessionId)
//     if (playerSession) {
//       await PlayerCacheService.savePlayerSession(playerSession)
//     }
//   }

//   if (!playerSession) {
//     throw new AppError(404, 'Player not found')
//   }

//   if (userId && playerSession.player_id !== userId) {
//     throw new AppError(
//       403,
//       'You do not have permission to access this player data'
//     )
//   }

//   const gameSession = await gameRepository.getGameSessionById(sessionId)

//   if (!gameSession) {
//     throw new AppError(404, 'Session not found')
//   }

//   const currentQuestionIndex = playerSession.answered_questions?.length || 0
//   const totalQuestions = gameSession.total_questions

//   if (currentQuestionIndex >= totalQuestions) {
//     return {
//       isCompleted: true,
//       currentQuestion: null,
//       currentQuestionIndex,
//       totalQuestions
//     }
//   }

//   const currentQuestion = await getQuestionForGame(
//     sessionId,
//     currentQuestionIndex
//   )

//   return {
//     isCompleted: false,
//     currentQuestion,
//     currentQuestionIndex,
//     totalQuestions
//   }
// }

// export async function getPlayerSessionById(
//   playerSessionId: number
// ): Promise<PlayerSession | null> {
//   // Thử lấy từ cache trước
//   let playerSession = await PlayerCacheService.getPlayerSession(playerSessionId)

//   if (!playerSession) {
//     playerSession = await gameRepository.getPlayerSession(playerSessionId)
//     if (playerSession) {
//       await PlayerCacheService.savePlayerSession(playerSession)
//     }
//   }

//   return playerSession
// }

// export async function getGameSessionById(sessionId: number) {
//   return await gameRepository.getGameSessionById(sessionId)
// }

// export async function getPlayersByGameSession(
//   gameSessionId: number
// ): Promise<PlayerSession[]> {
//   // Thử lấy từ cache trước
//   const playerIds = await PlayerCacheService.getPlayerIds(gameSessionId)

//   if (playerIds.length > 0) {
//     const players: PlayerSession[] = []

//     for (const playerId of playerIds) {
//       const player = await PlayerCacheService.getPlayerSession(playerId)
//       if (player) {
//         players.push(player)
//       }
//     }

//     // Nếu lấy đủ players từ cache, return luôn
//     if (players.length === playerIds.length) {
//       return players
//     }
//   }

//   // Nếu không, query từ DB và cache lại
//   const players = await gameRepository.getPlayersByGameSession(gameSessionId)

//   // Cache từng player
//   const savePromises = players.map(player =>
//     PlayerCacheService.savePlayerSession(player)
//   )
//   await Promise.all(savePromises)

//   return players
// }
