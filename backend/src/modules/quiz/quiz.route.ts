import { Router } from 'express'
import { authMiddleware } from '../auth/auth.middleware.js'
import * as quizController from './quiz.controller.js'
import * as listingController from './listing.controller.js'
import {
  validateBody,
  validateParams,
  validateQuery
} from '../../shared/validators/validator.js'
import {
  createQuizSchema,
  feedQuerySchema,
  myQuizzesQuerySchema,
  ownerIdParamSchema,
  ownerQuizzesQuerySchema,
  quizIdParamSchema,
  searchQuizzesSchema,
  updateQuizSchema
} from './quiz.schema.js'
import { optionalAuthMiddleware } from '../../shared/middlewares/optional.auth.js'
import * as homeController from './home.controller.js'

export const quizRouter: Router = Router()

quizRouter.post( '/', authMiddleware, validateBody(createQuizSchema), quizController.createQuiz)

// Declaration order matters: every literal path is registered before any route
// with a dynamic segment, so a static route can never be swallowed by a pattern.
quizRouter.get('/search', optionalAuthMiddleware, validateQuery(searchQuizzesSchema), listingController.searchQuizzes)

quizRouter.get('/me', authMiddleware, validateQuery(myQuizzesQuerySchema), listingController.getMyQuizzes)

quizRouter.get('/home', optionalAuthMiddleware, homeController.getHome)

quizRouter.get('/feed', optionalAuthMiddleware, validateQuery(feedQuerySchema), homeController.getFeed)

// No auth middleware at all: a public profile returns the same rows to everyone,
// including the owner, who uses GET /quizzes/me to manage their own quizzes.
quizRouter.get('/users/id/:ownerId', validateParams(ownerIdParamSchema), validateQuery(ownerQuizzesQuerySchema), listingController.getQuizzesByOwner)

quizRouter.get('/id/:quizId', optionalAuthMiddleware, validateParams(quizIdParamSchema), quizController.getQuiz)

quizRouter.patch( '/id/:quizId', authMiddleware, validateParams(quizIdParamSchema), validateBody(updateQuizSchema), quizController.updateQuiz)

quizRouter.delete('/id/:quizId', authMiddleware, validateParams(quizIdParamSchema), quizController.deleteQuiz)
