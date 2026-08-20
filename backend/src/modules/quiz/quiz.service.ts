import type { Quiz } from './quiz.type.js'
import { quizRepository } from './quiz.repository.js'
import { AppError } from '../../shared/errors/AppError.js'
import type { CreateQuizRequest, UpdateQuizRequest } from './quiz.schema.js'

/*
 * Quiz CRUD rules. Listing and search moved to listing.service.ts, where every
 * visibility condition is part of the SQL query instead of a filter applied to
 * an already paginated result set.
 */

export async function createQuizService(
  userId: number,
  quiz: CreateQuizRequest
): Promise<Quiz> {
  // Validate questions
  const { questions, ...quizData } = quiz

  if (!questions || questions.length === 0) {
    throw new AppError(400, 'Quiz must have at least one question', 'QUIZ_NO_QUESTIONS')
  }

  // Insert quiz
  const createdQuiz = await quizRepository.insertQuiz(userId, quizData)
  if (!createdQuiz) {
    throw new AppError(500, 'Failed to create quiz', 'SERVER_ERROR')
  }

  // Insert questions
  const createdQuestions = await quizRepository.insertQuestions(
    createdQuiz.id,
    questions
  )

  // Verify all questions were created
  if (createdQuestions.length !== questions.length) {
    throw new AppError(500, 'Failed to create all questions', 'SERVER_ERROR')
  }

  // Re-read so the response carries the joined author and the counters the
  // insert just refreshed, in the exact shape GET /quizzes/id/:quizId returns.
  const fullQuiz = await quizRepository.getQuizById(createdQuiz.id)
  if (!fullQuiz) {
    throw new AppError(500, 'Failed to load the created quiz', 'SERVER_ERROR')
  }

  return fullQuiz
}

export async function getQuizService(
  userId: number,
  quizId: number
): Promise<Quiz> {
  const quiz = await quizRepository.getQuizById(quizId)

  // Check if quiz exists
  if (!quiz) {
    throw new AppError(404, 'Quiz not found', 'QUIZ_NOT_FOUND')
  }

  // Check access permission. A private quiz reads as missing on purpose: telling
  // the caller it exists would leak the owner's library.
  if (!quiz.is_public && quiz.quiz_owner !== userId) {
    throw new AppError(404, 'Quiz not found', 'QUIZ_NOT_FOUND')
  }

  return quiz
}

export async function updateQuizService(
  userId: number,
  quizId: number,
  quiz: UpdateQuizRequest
): Promise<Quiz> {
  // Check ownership
  const isOwner = await quizRepository.checkQuizOwnership(quizId, userId)
  if (!isOwner) {
    throw new AppError(404, 'Quiz not found or unauthorized', 'QUIZ_NOT_FOUND')
  }

  // Validate questions if provided
  if (quiz.questions !== undefined && quiz.questions.length === 0) {
    throw new AppError(400, 'Quiz must have at least one question', 'QUIZ_NO_QUESTIONS')
  }

  // Check if there's anything to update
  const { questions, ...quizMetadata } = quiz
  const hasMetadataUpdate = Object.keys(quizMetadata).length > 0
  const hasQuestionsUpdate = questions !== undefined && questions.length > 0

  if (!hasMetadataUpdate && !hasQuestionsUpdate) {
    throw new AppError(400, 'No valid fields to update', 'VALIDATION_ERROR')
  }

  // Update quiz metadata if provided
  if (hasMetadataUpdate) {
    const updatedQuiz = await quizRepository.updateQuizMetadata(
      quizId,
      userId,
      quizMetadata
    )
    if (!updatedQuiz) {
      throw new AppError(404, 'Quiz not found', 'QUIZ_NOT_FOUND')
    }
  }

  // Update questions if provided. Sending questions replaces the whole list.
  if (hasQuestionsUpdate && questions) {
    await quizRepository.replaceQuizQuestions(quizId, questions)
  }

  // Always re-read the final state. Stitching the two partial results together
  // used to return an empty question list on a metadata-only update.
  const finalQuiz = await quizRepository.getQuizById(quizId)
  if (!finalQuiz) {
    throw new AppError(404, 'Quiz not found', 'QUIZ_NOT_FOUND')
  }

  return finalQuiz
}

export async function deleteQuizService(
  userId: number,
  quizId: number
): Promise<Quiz> {
  // Check ownership
  const isOwner = await quizRepository.checkQuizOwnership(quizId, userId)
  if (!isOwner) {
    throw new AppError(404, 'Quiz not found or unauthorized', 'QUIZ_NOT_FOUND')
  }

  // Soft delete the quiz
  const deletedQuiz = await quizRepository.deleteQuiz(quizId)
  if (!deletedQuiz) {
    throw new AppError(404, 'Quiz not found or already deleted', 'QUIZ_NOT_FOUND')
  }

  return deletedQuiz
}
