import { Router } from 'express'
import { authMiddleware } from '../auth/auth.middleware.js'
import * as quizController from './quiz.controller.js'
import {
  validateBody,
  validateQuery
} from '../../shared/validators/validator.js'
import {
  createQuizSchema,
  listQuizzesSchema,
  searchQuizzesSchema,
  updateQuizSchema
} from '../../shared/validators/schemas.js'
import { optionalAuthMiddleware } from '../../shared/middlewares/optional.auth.js'

export const quizRouter = Router()

quizRouter.post(
  '/',
  authMiddleware,
  validateBody(createQuizSchema),
  quizController.createQuiz
)
quizRouter.get(
  '/search',
  optionalAuthMiddleware,
  validateQuery(searchQuizzesSchema),
  quizController.searchQuizzes
)
quizRouter.get(
  '/users/id/:ownerId',
  optionalAuthMiddleware,
  validateQuery(listQuizzesSchema),
  quizController.listQuizzes
)
quizRouter.get('/id/:quizId', optionalAuthMiddleware, quizController.getQuiz)
quizRouter.patch(
  '/id/:quizId',
  authMiddleware,
  validateBody(updateQuizSchema),
  quizController.updateQuiz
)
quizRouter.delete('/id/:quizId', authMiddleware, quizController.deleteQuiz)

// quizRouter.post('/id/:quizId/image', authMiddleware, quizController.uploadQuizImage)
