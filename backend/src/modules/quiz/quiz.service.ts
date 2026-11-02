import type { Quiz } from './quiz.type.js'
import { quizRepository } from './quiz.repository.js'
import { AppError } from '../../shared/errors/AppError.js'
import type { CreateQuizRequest, UpdateQuizRequest } from './quiz.schema.js'
import { withTransaction } from '../../infrastructure/database/connection.js'
import { assertOwnedUpload } from '../storage/storage.service.js'

const validateImages = async (
  userId: number,
  image: string | undefined,
  questions?: CreateQuizRequest['questions'],
  existingUrls = new Set<string>()
) => {
  if (image && !existingUrls.has(image)) await assertOwnedUpload(image, 'quizzes', userId)
  for (const question of questions ?? []) {
    if (question.question_image && !existingUrls.has(question.question_image))
      await assertOwnedUpload(question.question_image, 'questions', userId)
  }
}

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

  await validateImages(userId, quizData.quiz_image, questions)

  const createdQuiz = await withTransaction(async (client) => {
    const inserted = await quizRepository.insertQuiz(userId, quizData, client)
    if (!inserted) throw new AppError(500, 'Failed to create quiz', 'SERVER_ERROR')
    const createdQuestions = await quizRepository.insertQuestions(inserted.id, questions, client)
    if (createdQuestions.length !== questions.length)
      throw new AppError(500, 'Failed to create all questions', 'SERVER_ERROR')
    return inserted
  })

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

  const previous = await quizRepository.getQuizById(quizId)
  const existingUrls = new Set([
    previous?.quiz_image,
    ...(previous?.questions.map((question) => question.question_image) ?? [])
  ].filter((value): value is string => !!value))
  await validateImages(userId, quizMetadata.quiz_image, questions, existingUrls)

  await withTransaction(async (client) => {
    const locked = await client.query(
      'SELECT id FROM quizzes WHERE id = $1 AND quiz_owner = $2 AND deleted_at IS NULL FOR UPDATE',
      [quizId, userId]
    )
    if (!locked.rows[0]) throw new AppError(404, 'Quiz not found', 'QUIZ_NOT_FOUND')
    if (hasMetadataUpdate) {
      const updated = await quizRepository.updateQuizMetadata(quizId, userId, quizMetadata, client)
      if (!updated) throw new AppError(404, 'Quiz not found', 'QUIZ_NOT_FOUND')
    }
    if (hasQuestionsUpdate && questions)
      await quizRepository.replaceQuizQuestions(quizId, questions, client)
    // Metadata updates already invalidate through the quizzes trigger. A
    // question-only replacement changes question_count once per question, so
    // invalidate exactly once after the complete batch instead.
    if (hasQuestionsUpdate && !hasMetadataUpdate)
      await client.query('UPDATE quiz_cache_generation SET generation = generation + 1 WHERE id = 1')
  })

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

  // Keep snapshots and match history when removing a quiz from listings.
  const deletedQuiz = await withTransaction(async (client) => {
    return quizRepository.deleteQuiz(quizId, client)
  })
  if (!deletedQuiz) {
    throw new AppError(404, 'Quiz not found or already deleted', 'QUIZ_NOT_FOUND')
  }

  return deletedQuiz
}
