import type { Response, NextFunction } from 'express'
import type { AuthRequest } from '../../shared/types/shared.types.js'
import type { Quiz } from './quiz.type.js'
import * as quizService from './quiz.service.js'

export async function createQuiz(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id as number

    const quiz = req.body as Quiz

    const createdQuiz = await quizService.createQuizService(userId, quiz)

    res.status(201).json(createdQuiz)
  } catch (error) {
    next(error)
  }
}

export async function getQuiz(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id as number
    const quizId = Number(req.params?.quizId)

    const quiz = await quizService.getQuizService(userId, quizId)

    res.status(200).json(quiz)
  } catch (error) {
    next(error)
  }
}

export async function listQuizzes(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id as number
    const ownerId = Number(req.params?.ownerId)
    const { page, limit } = req.validatedQuery as { page: number; limit: number }

    const quizzes = await quizService.listQuizzesService(userId, ownerId, { page, limit })

    res.status(200).json(quizzes)
  } catch (error) {
    next(error)
  }
}

export async function updateQuiz(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id as number
    const quizId = Number(req.params?.quizId)
    const quiz = req.body as Quiz

    const updatedQuiz = await quizService.updateQuizService(userId, quizId, quiz)

    res.status(200).json(updatedQuiz)
  } catch (error) {
    next(error)
  }
}

export async function deleteQuiz(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id as number
    const quizId = Number(req.params?.quizId)

    const deletedQuiz = await quizService.deleteQuizService(userId, quizId)

    res.status(200).json(deletedQuiz)
  } catch (error) {
    next(error)
  }
}

export async function searchQuizzes(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id as number
    const { keyword, language, category, page, limit } = req.validatedQuery as {
      keyword?: string
      language?: string
      category?: string
      page: number
      limit: number
    }

    const quizzes = await quizService.searchQuizzesService(userId, {
      keyword,
      language,
      category,
      page,
      limit
    })

    res.status(200).json(quizzes)
  } catch (error) {
    next(error)
  }
}
