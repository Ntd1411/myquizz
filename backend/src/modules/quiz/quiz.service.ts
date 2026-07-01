import type { PaginatedResponse, Quiz } from './quiz.type.js'
import { quizRepository } from './quiz.repository.js'
import { AppError } from '../../shared/errors/AppError.js'

export async function createQuizService(
  userId: number,
  quiz: Quiz
): Promise<Quiz> {
  // Validate questions
  const { questions, ...quizData } = quiz

  if (!questions || questions.length === 0) {
    throw new AppError(400, 'Quiz must have at least one question')
  }

  // Insert quiz
  const createdQuiz = await quizRepository.insertQuiz(userId, quizData)
  if (!createdQuiz) {
    throw new AppError(500, 'Failed to create quiz')
  }

  // Insert questions
  const createdQuestions = await quizRepository.insertQuestions(
    createdQuiz.id,
    questions
  )

  // Verify all questions were created
  if (createdQuestions.length !== questions.length) {
    throw new AppError(500, 'Failed to create all questions')
  }

  return { ...createdQuiz, questions: createdQuestions }
}

export async function listQuizzesService(
  userId: number,
  ownerId: number,
  pagination: { page: number; limit: number }
): Promise<PaginatedResponse<Quiz>> {
  const offset = (pagination.page - 1) * pagination.limit
  const total = await quizRepository.countQuizzesByOwner(ownerId)
  const result = await quizRepository.getListQuizzes(ownerId, offset, pagination.limit)

  const results: PaginatedResponse<Quiz> = {
    data: result.filter((quiz) => quiz.is_public || quiz.quiz_owner === userId),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: total,
      totalPages: Math.ceil(total / pagination.limit),
      hasPreviousPage: pagination.page > 1,
      hasNextPage: offset + pagination.limit < total
    }
  }

  return results
}

export async function getQuizService(
  userId: number,
  quizId: number
): Promise<Quiz> {
  const quiz = await quizRepository.getQuizById(quizId)

  // Check if quiz exists
  if (!quiz) {
    throw new AppError(404, 'Quiz not found')
  }

  // Check access permission
  if (!quiz.is_public && quiz.quiz_owner !== userId) {
    throw new AppError(404, 'Quiz not found')
  }

  return quiz
}

export async function updateQuizService(
  userId: number,
  quizId: number,
  quiz: Quiz
): Promise<Quiz> {
  // Check ownership
  const isOwner = await quizRepository.checkQuizOwnership(quizId, userId)
  if (!isOwner) {
    throw new AppError(404, 'Quiz not found or unauthorized')
  }

  // Validate questions if provided
  if (quiz.questions !== undefined && quiz.questions.length === 0) {
    throw new AppError(400, 'Quiz must have at least one question')
  }

  // Check if there's anything to update
  const { questions, ...quizMetadata } = quiz
  const hasMetadataUpdate = Object.keys(quizMetadata).length > 0
  const hasQuestionsUpdate = questions !== undefined && questions.length > 0

  if (!hasMetadataUpdate && !hasQuestionsUpdate) {
    throw new AppError(400, 'No valid fields to update')
  }

  // Update quiz metadata if provided
  let updatedQuiz: Quiz | null = null
  if (hasMetadataUpdate) {
    updatedQuiz = await quizRepository.updateQuizMetadata(
      quizId,
      userId,
      quizMetadata
    )
    if (!updatedQuiz) {
      throw new AppError(404, 'Quiz not found')
    }
  }

  // Update questions if provided
  let updatedQuestions: typeof quiz.questions = []
  if (hasQuestionsUpdate && questions) {
    updatedQuestions = await quizRepository.replaceQuizQuestions(
      quizId,
      questions
    )
  }

  // Get the final quiz state
  if (!updatedQuiz || !updatedQuestions) {
    updatedQuiz = await quizRepository.getQuizById(quizId)
    if (!updatedQuiz) {
      throw new AppError(404, 'Quiz not found')
    }
  } else {
    updatedQuiz.questions = updatedQuestions
  }

  return updatedQuiz
}

export async function deleteQuizService(
  userId: number,
  quizId: number
): Promise<Quiz> {
  // Check ownership
  const isOwner = await quizRepository.checkQuizOwnership(quizId, userId)
  if (!isOwner) {
    throw new AppError(404, 'Quiz not found or unauthorized')
  }

  // Soft delete the quiz
  const deletedQuiz = await quizRepository.deleteQuiz(quizId)
  if (!deletedQuiz) {
    throw new AppError(404, 'Quiz not found or already deleted')
  }

  return deletedQuiz
}

export async function searchQuizzesService(
  userId: number,
  query: {
    keyword?: string | undefined;
    language?: string | undefined;
    category?: string | undefined;
    page: number;
    limit: number;
  }
): Promise<PaginatedResponse<Quiz>> {
  try {
    const offset = (query.page - 1) * query.limit

    const { data, total } = await quizRepository.searchQuizzes(
      offset,
      query.keyword,
      query.language,
      query.category
    )

    const results: PaginatedResponse<Quiz> = {
      data: data.filter((quiz) => quiz.is_public || quiz.quiz_owner === userId),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        hasPreviousPage: query.page > 1,
        hasNextPage: offset + query.limit < total
      }
    }

    return results
  } catch (error) {
    throw new AppError(500, 'Failed to search quizzes', error)
  }
}
