import type { Response, NextFunction } from 'express'
import type { Quiz } from './quiz.type.js'
import * as quizService from './quiz.service.js'
import type { CreateQuizRequest } from './quiz.schema.js'
import type { AuthRequest } from '../auth/auth.type.js'
import { success } from '../../shared/utils/response.js'

/*
 * Quiz CRUD. The listing endpoints (search, public profile, /quizzes/me) live in
 * listing.controller.ts so this file stays on the write path.
 */

export async function createQuiz(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id as number

    const quiz = req.body as CreateQuizRequest

    const createdQuiz = await quizService.createQuizService(userId, quiz)

    return success(res, { quiz: createdQuiz }, 201)
  } catch (error) {
    next(error)
  }
}

export async function getQuiz(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id as number
    const quizId = Number(req.params?.quizId)

    const quiz = await quizService.getQuizService(userId, quizId)

    return success(res, { quiz })
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

    return success(res, { quiz: updatedQuiz })
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

    return success(res, { quiz: deletedQuiz })
  } catch (error) {
    next(error)
  }
}
