/* eslint-disable max-len */
import { Router } from 'express'
import { authMiddleware } from '../auth/auth.middleware.js'
import * as quizController from './quiz.controller.js'
import {
  validateBody,
  validateQuery
} from '../../shared/validators/validator.js'
import {
  createQuizSchema,
  feedQuerySchema,
  listQuizzesSchema,
  searchQuizzesSchema,
  updateQuizSchema
} from './quiz.schema.js'
import { optionalAuthMiddleware } from '../../shared/middlewares/optional.auth.js'
import * as homeController from './home.controller.js'

export const quizRouter: Router = Router()

quizRouter.post( '/', authMiddleware, validateBody(createQuizSchema), quizController.createQuiz)

quizRouter.get( '/search', optionalAuthMiddleware, validateQuery(searchQuizzesSchema), quizController.searchQuizzes)

quizRouter.get('/home', optionalAuthMiddleware, homeController.getHome)

quizRouter.get('/feed', optionalAuthMiddleware, validateQuery(feedQuerySchema), homeController.getFeed)

quizRouter.get( '/users/id/:ownerId', optionalAuthMiddleware, validateQuery(listQuizzesSchema), quizController.listQuizzes)

quizRouter.get('/id/:quizId', optionalAuthMiddleware, quizController.getQuiz)

quizRouter.patch( '/id/:quizId', authMiddleware, validateBody(updateQuizSchema), quizController.updateQuiz)

quizRouter.delete('/id/:quizId', authMiddleware, quizController.deleteQuiz)

/**
 * @openapi
 * tags:
 *   - name: Quizzes
 *     description: Quiz CRUD and search
 *
 * /quizzes:
 *   post:
 *     summary: Create a quiz with its questions
 *     tags: [Quizzes]
 *     security: [ { cookieAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [quiz_name, quiz_language, is_public, questions]
 *             properties:
 *               quiz_name: { type: string, minLength: 3, maxLength: 100 }
 *               quiz_description: { type: string, maxLength: 500 }
 *               quiz_language: { type: string }
 *               quiz_image: { type: string, format: uri }
 *               quiz_category: { type: string, maxLength: 50 }
 *               is_public: { type: boolean }
 *               questions:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [question_type, question_text, correct_answer]
 *                   properties:
 *                     question_type: { type: string, enum: [multiple_choice, multiple_select, short_answer, long_answer] }
 *                     question_text: { type: string, minLength: 1, maxLength: 200 }
 *                     time_limit: { type: number, minimum: 0, default: 30 }
 *                     question_image: { type: string, format: uri }
 *                     answer_options:
 *                       type: array
 *                       minItems: 2
 *                       maxItems: 4
 *                       items: { type: string, minLength: 1, maxLength: 100 }
 *                     correct_answer:
 *                       oneOf:
 *                         - { type: array, items: { type: number }, minItems: 1 }
 *                         - { type: string, minLength: 1 }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { quiz: { $ref: '#/components/schemas/Quiz' } } }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *
 * /quizzes/search:
 *   get:
 *     summary: Search quizzes (optional auth also surfaces the caller's own private quizzes)
 *     tags: [Quizzes]
 *     parameters:
 *       - { in: query, name: keyword, schema: { type: string, maxLength: 200 } }
 *       - { in: query, name: language, schema: { type: string, maxLength: 50 } }
 *       - { in: query, name: category, schema: { type: string, maxLength: 50 } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 20, default: 10 } }
 *     responses:
 *       200:
 *         description: Items under data.quizzes; page info under meta.pagination
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         quizzes: { type: array, items: { $ref: '#/components/schemas/Quiz' } }
 *                     meta: { $ref: '#/components/schemas/ApiMeta' }
 *
 * /quizzes/users/id/{ownerId}:
 *   get:
 *     summary: List a user's quizzes (paginated)
 *     tags: [Quizzes]
 *     parameters:
 *       - { in: path, name: ownerId, required: true, schema: { type: integer } }
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, minimum: 1, maximum: 20, default: 10 } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         quizzes: { type: array, items: { $ref: '#/components/schemas/Quiz' } }
 *                     meta: { $ref: '#/components/schemas/ApiMeta' }
 *
 * /quizzes/id/{quizId}:
 *   get:
 *     summary: Get a quiz with its questions
 *     tags: [Quizzes]
 *     parameters:
 *       - { in: path, name: quizId, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { quiz: { $ref: '#/components/schemas/Quiz' } } }
 *       404: { description: Quiz not found }
 *   patch:
 *     summary: Update a quiz (partial; sending questions replaces the whole list)
 *     tags: [Quizzes]
 *     security: [ { cookieAuth: [] } ]
 *     parameters:
 *       - { in: path, name: quizId, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quiz_name: { type: string, minLength: 3, maxLength: 100 }
 *               quiz_description: { type: string, maxLength: 500 }
 *               quiz_language: { type: string }
 *               quiz_image: { type: string, format: uri }
 *               quiz_category: { type: string, maxLength: 50 }
 *               is_public: { type: boolean }
 *               questions: { type: array, items: { type: object } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { quiz: { $ref: '#/components/schemas/Quiz' } } }
 *       403: { description: Not the owner }
 *       404: { description: Quiz not found }
 *   delete:
 *     summary: Soft-delete a quiz
 *     tags: [Quizzes]
 *     security: [ { cookieAuth: [] } ]
 *     parameters:
 *       - { in: path, name: quizId, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object, properties: { quiz: { $ref: '#/components/schemas/Quiz' } } }
 *       403: { description: Not the owner }
 *       404: { description: Quiz not found }
 */
